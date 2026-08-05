/* Split-word reveal (ReactBits "SplitText"-style), ported to vanilla JS.
   Usage: add class="split-reveal" to any heading. Animates once, either
   immediately if already in view on load, or on scroll into view. */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var targets = document.querySelectorAll('.split-reveal');
  if (!targets.length) return;

  var STEP_MS = 55;

  var style = document.createElement('style');
  style.textContent =
    '.sr-word{display:inline-block;overflow:hidden;vertical-align:bottom;}' +
    '.sr-word>span{display:inline-block;transform:translateY(115%);opacity:0;' +
    'animation:srWordUp 0.85s cubic-bezier(0.215,0.61,0.355,1) forwards;animation-play-state:paused;}' +
    '.split-reveal.sr-run .sr-word>span{animation-play-state:running;}' +
    '@keyframes srWordUp{to{transform:translateY(0);opacity:1;}}';
  document.head.appendChild(style);

  function splitInto(el) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    var tokens = [];

    function tokenizeText(text, em) {
      if (/^\s/.test(text)) tokens.push({ type: 'space' });
      var words = text.split(/\s+/).filter(Boolean);
      words.forEach(function (w, i) {
        tokens.push({ type: 'word', text: w, em: em });
        if (i < words.length - 1) tokens.push({ type: 'space' });
      });
      if (/\s$/.test(text)) tokens.push({ type: 'space' });
    }

    nodes.forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        tokenizeText(node.textContent, false);
      } else if (node.nodeName === 'BR') {
        tokens.push({ type: 'br' });
      } else if (node.nodeName === 'EM') {
        tokenizeText(node.textContent, true);
      } else {
        tokens.push({ type: 'raw', node: node.cloneNode(true) });
      }
    });

    var frag = document.createDocumentFragment();
    var wordIndex = 0;
    var pendingSpace = false;

    tokens.forEach(function (tok) {
      if (tok.type === 'space') {
        pendingSpace = true;
        return;
      }
      if (tok.type === 'br') {
        frag.appendChild(document.createElement('br'));
        pendingSpace = false;
        return;
      }
      if (pendingSpace && frag.childNodes.length) {
        frag.appendChild(document.createTextNode(' '));
      }
      pendingSpace = false;

      if (tok.type === 'raw') {
        frag.appendChild(tok.node);
        return;
      }

      var wrap = document.createElement('span');
      wrap.className = 'sr-word';
      var inner = document.createElement('span');
      inner.style.animationDelay = wordIndex * STEP_MS + 'ms';
      if (tok.em) {
        var emEl = document.createElement('em');
        emEl.textContent = tok.text;
        inner.appendChild(emEl);
      } else {
        inner.textContent = tok.text;
      }
      wrap.appendChild(inner);
      frag.appendChild(wrap);
      wordIndex++;
    });

    el.textContent = '';
    el.appendChild(frag);
  }

  targets.forEach(splitInto);

  function run(el) {
    if (el.classList.contains('sr-run')) return;
    el.classList.add('sr-run');
  }

  if (!('IntersectionObserver' in window)) {
    targets.forEach(run);
    return;
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          run(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );
  targets.forEach(function (el) {
    io.observe(el);
  });
})();
