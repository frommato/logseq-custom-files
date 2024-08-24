// https://github.com/cannibalox/logseq-custom-files/blob/main/custom.js

// COMMON ====================================================================
MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
const watchTarget = document.getElementById("app-container");
// const watchTarget = document.body;

// throttle MutationObserver, make a call after throttle timer runs out 
function throttle(func, delay) {
    let lastCall = 0;
    let timeoutId;

    return function (...args) {
        const now = new Date().getTime();

        if (now - lastCall < delay) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                lastCall = now;
                func.apply(this, args);
            }, delay - (now - lastCall));
        } else {
            lastCall = now;
            func.apply(this, args);
        }
    };
}

// END COMMON =================================================================


console.log("========= custom.js loaded =========");

// https://github.com/component/textarea-caret-position
// https://jsfiddle.net/dandv/aFPA7/

// The properties that we copy into a mirrored div.
// Note that some browsers, such as Firefox,
// do not concatenate properties, i.e. padding-top, bottom etc. -> padding,
// so we have to do every single property specifically.
var properties = [
    'boxSizing',
    'width',  // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
    'height',
    'overflowX',
    'overflowY',  // copy the scrollbar for IE

    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',

    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',

    // https://developer.mozilla.org/en-US/docs/Web/CSS/font
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'lineHeight',
    'fontFamily',

    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',  // might not make a difference, but better be safe

    'letterSpacing',
    'wordSpacing'
];

var isFirefox = !(window.mozInnerScreenX == null);
var mirrorDiv;
var blinkInterval;
var fauxcaret;


createCaret = function (element) {
    // var fontSize = getComputedStyle(element).getPropertyValue('font-size');
    var caret = document.createElement('div');
    caret.className = 'fauxcaret';
    element.parentNode.appendChild(caret);

    caret.style.position = 'absolute';
    caret.style.backgroundColor = 'red';
    caret.style.height = '20px';
    caret.style.width = '2px';
    caret.style.top = '0px';
    caret.style.left = '0px';
    // caret.style.opacity = 0.2;
    // caret.style.visibility = 'hidden';

    return caret;
}


const updateTextareas = function () {
    // in Logseq sometimes a new textarea gets focused before mutation observer kicks in
    // so the fauxcaret stays invisible unfil the first keypress
    // -> if current focused element is a textarea, then call update on it
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') {
        if (!document.activeElement.classList.contains('has-fauxcaret')) {
            // console.log('forcing update')
            update(document.activeElement);
        }
    }

    const nodes = document.querySelectorAll('textarea.normal-block, input.edit-input');
    nodes.forEach(node => {
        if (node.classList.contains('has-fauxcaret')) return;

        node.classList.add('has-fauxcaret');

        // console.log('addind event listeners');
        node.addEventListener('keydown', function () { slowUpdate(this); });
        node.addEventListener('click', function () { slowUpdate(this); });
        node.addEventListener('scroll', function () { update(this); });
        node.addEventListener('focus', function () { slowUpdate(this); });
        node.addEventListener('blur', hideCaret);

        // hide the native caret
        node.style.caretColor = 'transparent';
    })
};


const updateTextareasThrottled = throttle(updateTextareas, 100);
const obsTextareas = new MutationObserver(updateTextareasThrottled);
obsTextareas.observe(watchTarget, {
    subtree: true,
    childList: true,
});



getCaretCoordinates = function (element, position) {
    var computed, style;

    // mirrored div
    mirrorDiv = element.parentNode.querySelector('.' + element.nodeName + '--mirror-div');
    if (!mirrorDiv) {
        mirrorDiv = document.createElement('div');
        mirrorDiv.className = element.nodeName + '--mirror-div';
        element.parentNode.appendChild(mirrorDiv);
    }

    style = mirrorDiv.style;
    computed = getComputedStyle(element);

    // default textarea styles
    style.whiteSpace = 'pre-wrap';
    if (element.nodeName !== 'INPUT')
        // style.wordWrap = 'break-word';  // only for textarea-s
        style.overflowWrap = 'break-word';  // only for textarea-s

    // position off-screen
    style.position = 'absolute';  // required to return coordinates properly
    style.top = element.offsetTop + parseInt(computed.borderTopWidth) + 'px';
    // style.left = "400px";
    // style.visibility = 'visible';
    style.left = "0px";
    style.visibility = 'hidden';
    // style.visibility = mirrorDivDisplayCheckbox.checked ? 'visible' : 'hidden';  // not 'display: none' because we want rendering

    // transfer the element's properties to the div
    properties.forEach(function (prop) {
        style[prop] = computed[prop];
    });

    if (isFirefox) {
        style.width = parseInt(computed.width) - 2 + 'px'  // Firefox adds 2 pixels to the padding - https://bugzilla.mozilla.org/show_bug.cgi?id=753662
        // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
        if (element.scrollHeight > parseInt(computed.height))
            style.overflowY = 'scroll';
    } else {
        style.overflow = 'hidden';  // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
    }

    mirrorDiv.textContent = element.value.substring(0, position);
    // the second special handling for input type="text" vs textarea: spaces need to be replaced with non-breaking spaces - http://stackoverflow.com/a/13402035/1269037
    if (element.nodeName === 'INPUT')
        mirrorDiv.textContent = mirrorDiv.textContent.replace(/\s/g, "\u00a0");

    var span = document.createElement('span');
    // Wrapping must be replicated *exactly*, including when a long word gets
    // onto the next line, with whitespace at the end of the line before (#7).
    // The  *only* reliable way to do that is to copy the *entire* rest of the
    // textarea's content into the <span> created at the caret position.
    // for inputs, just '.' would be enough, but why bother?
    span.textContent = element.value.substring(position) || '.';  // || because a completely empty faux span doesn't render at all
    span.style.backgroundColor = "lightgrey";
    mirrorDiv.appendChild(span);

    var coordinates = {
        top: span.offsetTop + parseInt(computed['borderTopWidth']),
        left: span.offsetLeft + parseInt(computed['borderLeftWidth'])
    };

    return coordinates;
}

function showCaret() {
    // console.log('showcaret');
    fauxcaret.style.visibility = 'visible';
    // blink fauxcaret every 500ms
    clearInterval(blinkInterval);
    blinkInterval = setInterval(blinkCaret, 500);
}

function hideCaret() {
    // console.log('hidecaret');
    // stop fauxcaret blinking
    clearInterval(blinkInterval);
    fauxcaret.style.visibility = 'hidden';
    fauxcaret.style.top = '0px';
    fauxcaret.style.left = '0px';
}

function blinkCaret() {
    if (fauxcaret.style.visibility === 'visible') {
        fauxcaret.style.visibility = 'hidden';
    } else {
        fauxcaret.style.visibility = 'visible';
    }
}

function slowUpdate(element) {
    // console.log('slowupdate');
    // add some delay to let caret position update
    setTimeout(function () { update(element); }, 20);
}

function update(element) {
    // console.log('update');
    if (element.nodeName !== 'TEXTAREA' && element.nodeName !== 'INPUT') return;
    if (element !== document.activeElement) return;

    fauxcaret = element.parentNode.querySelector('.fauxcaret');
    if (!fauxcaret) { fauxcaret = createCaret(element); }

    // if something is selected then hide the fauxcaret and return
    if (element.selectionStart !== element.selectionEnd) {
        hideCaret();
        return;
    }

    // var fontSize = getComputedStyle(element).getPropertyValue('font-size');
    var lineHeight = getComputedStyle(element).getPropertyValue('line-height');
    fauxcaret.style.height = lineHeight;

    // show the fauxcaret
    showCaret();

    var coordinates = getCaretCoordinates(element, element.selectionEnd);
    // console.log('(top, left) = (%s, %s)', coordinates.top, coordinates.left);
    fauxcaret.style.top = element.offsetTop
        - element.scrollTop
        + coordinates.top
        + 'px';
    fauxcaret.style.left = element.offsetLeft
        - element.scrollLeft
        + coordinates.left
        + 'px';
}
