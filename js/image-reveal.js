/* Fade/rise-in reveal for in-article gallery images (ReactBits-style scroll reveal).
   Progressive enhancement only: images stay fully visible by default in HTML/CSS.
   This script marks them hidden only once it is actually running, and always
   guarantees a fallback so nothing can get stuck invisible. */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  var imgs = document.querySelectorAll('.post-gallery img');
  if (!imgs.length) return;

  var style = document.createElement('style');
  style.textContent =
    '.img-reveal{opacity:0;transform:translateY(28px);' +
    'transition:opacity 0.8s cubic-bezier(0.215,0.61,0.355,1),transform 0.8s cubic-bezier(0.215,0.61,0.355,1);}' +
    '.img-reveal.img-visible{opacity:1;transform:translateY(0);}';
  document.head.appendChild(style);

  function reveal(img) {
    img.classList.add('img-visible');
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var img = entry.target;
        io.unobserve(img);
        if (img.complete) {
          reveal(img);
        } else {
          img.addEventListener('load', function () { reveal(img); }, { once: true });
          img.addEventListener('error', function () { reveal(img); }, { once: true });
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px 100px 0px' }
  );

  imgs.forEach(function (img) {
    img.classList.add('img-reveal');
    io.observe(img);
  });

  // Safety net: force-reveal everything after 4s no matter what, so a stalled
  // network image or an edge-case observer failure can never leave a gap.
  setTimeout(function () {
    imgs.forEach(reveal);
  }, 4000);
})();
