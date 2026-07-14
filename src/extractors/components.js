export function extractComponents(computedStyles) {
  const components = {};

  // Buttons — with variant detection
  const buttons = computedStyles.filter(el =>
    el.tag === 'button' || el.role === 'button' ||
    (el.tag === 'a' && /btn|button/i.test(el.classList))
  );
  if (buttons.length > 0) {
    // Group by background color to detect variants
    const bgGroups = new Map();
    for (const btn of buttons) {
      const bg = btn.backgroundColor || 'transparent';
      if (!bgGroups.has(bg)) bgGroups.set(bg, []);
      bgGroups.get(bg).push(btn);
    }
    const variants = [...bgGroups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([bg, group], i) => {
        let variant = 'default';
        if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') variant = 'ghost';
        else if (i === 0) variant = 'primary';
        else if (i === 1) variant = 'secondary';
        else variant = `variant-${i + 1}`;
        return { variant, backgroundColor: bg, count: group.length, style: mostCommonStyle(group, ['color', 'fontSize', 'fontWeight', 'paddingTop', 'paddingRight', 'borderRadius']) };
      });
    components.buttons = {
      count: buttons.length,
      baseStyle: mostCommonStyle(buttons, ['backgroundColor', 'color', 'fontSize', 'fontWeight', 'paddingTop', 'paddingRight', 'borderRadius']),
      variants,
    };
  }

  // Cards
  const cards = computedStyles.filter(el =>
    /card/i.test(el.classList) ||
    (el.tag === 'div' && el.boxShadow !== 'none' && el.borderRadius !== '0px' && el.backgroundColor !== 'rgba(0, 0, 0, 0)')
  );
  if (cards.length > 0) {
    components.cards = {
      count: cards.length,
      baseStyle: mostCommonStyle(cards, ['backgroundColor', 'borderRadius', 'boxShadow', 'paddingTop', 'paddingRight']),
    };
  }

  // Inputs
  const inputs = computedStyles.filter(el =>
    ['input', 'textarea', 'select'].includes(el.tag)
  );
  if (inputs.length > 0) {
    components.inputs = {
      count: inputs.length,
      baseStyle: mostCommonStyle(inputs, ['backgroundColor', 'color', 'borderColor', 'borderRadius', 'fontSize', 'paddingTop', 'paddingRight']),
    };
  }

  // Links
  const links = computedStyles.filter(el => el.tag === 'a');
  if (links.length > 0) {
    components.links = {
      count: links.length,
      baseStyle: mostCommonStyle(links, ['color', 'fontSize', 'fontWeight']),
    };
  }

  // Navigation
  const navs = computedStyles.filter(el =>
    el.tag === 'nav' || el.role === 'navigation' ||
    /nav|navbar|header/i.test(el.classList)
  );
  if (navs.length > 0) {
    components.navigation = {
      count: navs.length,
      baseStyle: mostCommonStyle(navs, ['backgroundColor', 'color', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'position', 'boxShadow']),
    };
  }

  // Footer
  const footers = computedStyles.filter(el =>
    el.tag === 'footer' || el.role === 'contentinfo' ||
    /footer/i.test(el.classList)
  );
  if (footers.length > 0) {
    components.footer = {
      count: footers.length,
      baseStyle: mostCommonStyle(footers, ['backgroundColor', 'color', 'paddingTop', 'paddingBottom', 'fontSize']),
    };
  }

  // Modals / Dialogs
  const modals = computedStyles.filter(el =>
    el.tag === 'dialog' || el.role === 'dialog' || el.role === 'alertdialog' ||
    /modal|dialog|overlay|popup/i.test(el.classList)
  );
  if (modals.length > 0) {
    components.modals = {
      count: modals.length,
      baseStyle: mostCommonStyle(modals, ['backgroundColor', 'borderRadius', 'boxShadow', 'paddingTop', 'paddingRight', 'maxWidth']),
    };
  }

  // Dropdowns / Menus
  const dropdowns = computedStyles.filter(el =>
    el.role === 'menu' || el.role === 'listbox' ||
    /dropdown|menu|popover|combobox/i.test(el.classList)
  );
  if (dropdowns.length > 0) {
    components.dropdowns = {
      count: dropdowns.length,
      baseStyle: mostCommonStyle(dropdowns, ['backgroundColor', 'borderRadius', 'boxShadow', 'borderColor', 'paddingTop']),
    };
  }

  // Tables
  const tables = computedStyles.filter(el => el.tag === 'table' || el.role === 'table');
  const tableCells = computedStyles.filter(el => ['td', 'th'].includes(el.tag));
  if (tables.length > 0 || tableCells.length > 10) {
    components.tables = {
      count: tables.length,
      cellCount: tableCells.length,
      baseStyle: {
        ...mostCommonStyle(tables, ['borderColor', 'backgroundColor']),
        cellStyle: mostCommonStyle(tableCells, ['paddingTop', 'paddingRight', 'borderColor', 'fontSize']),
      },
    };
  }

  // Badges / Tags / Pills
  const badges = computedStyles.filter(el =>
    /badge|tag|pill|chip|label/i.test(el.classList) &&
    el.area < 5000 && el.area > 100
  );
  if (badges.length > 0) {
    components.badges = {
      count: badges.length,
      baseStyle: mostCommonStyle(badges, ['backgroundColor', 'color', 'fontSize', 'fontWeight', 'paddingTop', 'paddingRight', 'borderRadius']),
    };
  }

  // Avatars
  const avatars = computedStyles.filter(el =>
    /avatar/i.test(el.classList) ||
    (el.tag === 'img' && el.borderRadius === '9999px' && el.area < 10000 && el.area > 400)
  );
  if (avatars.length > 0) {
    components.avatars = {
      count: avatars.length,
      baseStyle: mostCommonStyle(avatars, ['borderRadius', 'backgroundColor']),
    };
  }

  // Tabs
  const tabs = computedStyles.filter(el =>
    el.role === 'tab' || /\btab\b/i.test(el.classList)
  );
  if (tabs.length > 0) {
    components.tabs = {
      count: tabs.length,
      baseStyle: mostCommonStyle(tabs, ['backgroundColor', 'color', 'fontSize', 'fontWeight', 'paddingTop', 'paddingRight', 'borderColor', 'borderRadius']),
    };
  }

  // Accordions
  const accordions = computedStyles.filter(el =>
    /accordion/i.test(el.classList) ||
    (el.tag === 'summary') ||
    (el.tag === 'details')
  );
  if (accordions.length > 0) {
    components.accordions = {
      count: accordions.length,
      baseStyle: mostCommonStyle(accordions, ['backgroundColor', 'color', 'fontSize', 'paddingTop', 'paddingRight', 'borderColor']),
    };
  }

  // Tooltips
  const tooltips = computedStyles.filter(el =>
    el.role === 'tooltip' || /tooltip/i.test(el.classList)
  );
  if (tooltips.length > 0) {
    components.tooltips = {
      count: tooltips.length,
      baseStyle: mostCommonStyle(tooltips, ['backgroundColor', 'color', 'fontSize', 'borderRadius', 'paddingTop', 'paddingRight', 'boxShadow']),
    };
  }

  // Progress bars
  const progressBars = computedStyles.filter(el =>
    el.tag === 'progress' || el.role === 'progressbar' || /progress/i.test(el.classList)
  );
  if (progressBars.length > 0) {
    components.progressBars = {
      count: progressBars.length,
      baseStyle: mostCommonStyle(progressBars, ['backgroundColor', 'color', 'borderRadius', 'fontSize']),
    };
  }

  // Switches / Toggles
  const switches = computedStyles.filter(el =>
    el.role === 'switch' ||
    /switch|toggle/i.test(el.classList)
  );
  if (switches.length > 0) {
    components.switches = {
      count: switches.length,
      baseStyle: mostCommonStyle(switches, ['backgroundColor', 'borderRadius', 'borderColor']),
    };
  }

  // Generate CSS snippets for each component
  for (const [type, data] of Object.entries(components)) {
    if (data.baseStyle) {
      const style = type === 'tables' ? { ...data.baseStyle } : data.baseStyle;
      delete style.cellStyle;
      data.css = styleToCss(`.${type.replace(/s$/, '')}`, style);
    }
  }

  return components;
}

function styleToCss(selector, style) {
  const propMap = {
    backgroundColor: 'background-color', color: 'color', fontSize: 'font-size',
    fontWeight: 'font-weight', paddingTop: 'padding-top', paddingRight: 'padding-right',
    paddingBottom: 'padding-bottom', paddingLeft: 'padding-left',
    borderRadius: 'border-radius', boxShadow: 'box-shadow', borderColor: 'border-color',
    maxWidth: 'max-width', position: 'position',
  };
  const lines = Object.entries(style)
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${propMap[k] || k}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

function mostCommonStyle(elements, properties) {
  const style = {};
  for (const prop of properties) {
    const counts = new Map();
    for (const el of elements) {
      const val = el[prop];
      if (val && val !== 'none' && val !== 'auto' && val !== 'normal' && val !== 'rgba(0, 0, 0, 0)') {
        counts.set(val, (counts.get(val) || 0) + 1);
      }
    }
    if (counts.size > 0) {
      style[prop] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }
  return style;
}
