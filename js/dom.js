/* ==========================================================================
   Petits utilitaires DOM partages par les composants.
   ========================================================================== */
(function (global) {
  'use strict';

  /** Echappe le texte destine a du HTML ou du SVG. */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Cree un element a partir d'une chaine HTML. */
  function el(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  /**
   * Affecte une valeur a un champ SANS perturber la saisie en cours :
   * si l'utilisateur a le focus dessus (frappe ou glissement de curseur),
   * on ne touche pas au champ.
   */
  function setVal(input, value) {
    if (!input) return;
    if (document.activeElement === input) return;
    var v = String(value);
    if (input.value !== v) input.value = v;
  }

  /** Met a jour le texte d'un noeud uniquement s'il a change. */
  function setText(node, text) {
    if (!node) return;
    var v = String(text);
    if (node.textContent !== v) node.textContent = v;
  }

  function setHtml(node, html) {
    if (!node) return;
    if (node.innerHTML !== html) node.innerHTML = html;
  }

  function toggleClass(node, cls, on) {
    if (!node) return;
    node.classList.toggle(cls, !!on);
  }

  /** Formatage en francais : 78 750 € */
  function eur(n) {
    return Math.round(n).toLocaleString('fr-FR');
  }

  global.MGDom = {
    esc: esc,
    el: el,
    setVal: setVal,
    setText: setText,
    setHtml: setHtml,
    toggleClass: toggleClass,
    eur: eur
  };
})(window);
