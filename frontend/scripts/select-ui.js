/**
 * select-ui.js
 * Small shared helper for rendering native selects with consistent markup.
 */

(function () {
  'use strict';

  function escapeValue(value) {
    var str = value == null ? '' : String(value);
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildOption(option) {
    var value = escapeValue(option && option.value != null ? option.value : '');
    var label = escapeValue(option && option.label != null ? option.label : '');
    var selected = option && option.selected ? ' selected' : '';
    return '<option value="' + value + '"' + selected + '>' + label + '</option>';
  }

  function buildOptions(options) {
    return (options || []).map(buildOption).join('');
  }

  function buildNativeSelect(config) {
    var cfg = config || {};
    var nameAttr = cfg.name ? ' name="' + escapeValue(cfg.name) + '"' : '';
    var ariaLabelAttr = cfg.ariaLabel ? ' aria-label="' + escapeValue(cfg.ariaLabel) + '"' : '';
    var styleAttr = cfg.width ? ' style="width:' + escapeValue(cfg.width) + ';"' : '';
    var optionsHtml = buildOptions(cfg.options);

    return '<select class="select-native"' + nameAttr + ariaLabelAttr + styleAttr + '>' + optionsHtml + '</select>';
  }

  function buildSelectWithPlaceholder(config) {
    var cfg = config || {};
    var selectedText = cfg.selectedText == null ? '' : String(cfg.selectedText);
    var hasSelected = selectedText.trim() !== '';
    var options = [{
      value: '',
      label: cfg.placeholder || '',
      selected: !hasSelected,
    }];

    if (hasSelected) {
      options.push({
        value: selectedText,
        label: cfg.selectedLabel == null ? selectedText : String(cfg.selectedLabel),
        selected: true,
      });
    }

    return buildNativeSelect({
      name: cfg.name,
      ariaLabel: cfg.ariaLabel,
      width: cfg.width,
      options: options,
    });
  }

  window.selectUI = {
    buildNativeSelect: buildNativeSelect,
    buildSelectWithPlaceholder: buildSelectWithPlaceholder,
  };
})();
