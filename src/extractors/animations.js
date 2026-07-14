export function extractAnimations(computedStyles, keyframes) {
  const transitionSet = new Set();
  const easingSet = new Set();
  const durationSet = new Set();
  const animationNames = new Set();
  const transitionProperties = {};

  for (const el of computedStyles) {
    if (el.transition && el.transition !== 'all 0s ease 0s' && el.transition !== 'none') {
      transitionSet.add(el.transition);

      // Extract duration — only match standalone duration values, not inside functions
      const dMatch = el.transition.match(/(?<![(\d])(\d+\.?\d*m?s)(?![)\w])/g);
      if (dMatch) dMatch.forEach(d => durationSet.add(d));

      const eMatch = el.transition.match(/(ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*\))/g);
      if (eMatch) eMatch.forEach(e => easingSet.add(e));

      // Extract which properties are animated
      const parts = el.transition.split(',').map(s => s.trim());
      for (const part of parts) {
        const prop = part.split(/\s+/)[0];
        if (prop && prop !== 'all') {
          transitionProperties[prop] = (transitionProperties[prop] || 0) + 1;
        }
      }
    }

    // Capture animation usage with full shorthand parsing
    if (el.animation && el.animation !== 'none 0s ease 0s 1 normal none running' && el.animation !== 'none') {
      const nameMatch = el.animation.match(/^([\w-]+)/);
      if (nameMatch && nameMatch[1] !== 'none') animationNames.add(nameMatch[1]);

      // Parse delay, iteration-count, fill-mode from shorthand
      const delayMatch = el.animation.match(/(?<!\d)(\d+\.?\d*m?s)\s+(\d+\.?\d*m?s)/);
      if (delayMatch) durationSet.add(delayMatch[1]); // duration is first, delay is second

      const iterMatch = el.animation.match(/\b(infinite|\d+)\b(?=\s+(normal|reverse|alternate)|\s+none|\s+running|\s+paused|$)/);
      const fillMatch = el.animation.match(/\b(none|forwards|backwards|both)\b/);
      // These are collected but don't need separate sets — they enrich keyframe data below
    }
  }

  // Enhanced keyframes with timing and properties changed
  const enhancedKeyframes = keyframes.map(kf => {
    const propertiesAnimated = new Set();
    for (const step of kf.steps) {
      const props = step.style.split(';').map(s => s.split(':')[0].trim()).filter(Boolean);
      props.forEach(p => propertiesAnimated.add(p));
    }
    return {
      name: kf.name,
      steps: kf.steps,
      propertiesAnimated: [...propertiesAnimated],
      isUsed: animationNames.has(kf.name),
    };
  });

  // Sort transition properties by usage
  const sortedProps = Object.entries(transitionProperties)
    .sort((a, b) => b[1] - a[1])
    .map(([prop, count]) => ({ property: prop, count }));

  // Classify timing patterns for each easing
  const classifiedEasings = [...easingSet].map(e => {
    let pattern = 'custom';
    if (e === 'linear') pattern = 'linear';
    else if (e === 'ease-in') pattern = 'ease-in';
    else if (e === 'ease-out') pattern = 'ease-out';
    else if (e === 'ease-in-out' || e === 'ease') pattern = 'ease-in-out';
    else {
      const cbMatch = e.match(/cubic-bezier\(\s*([\d.]+)\s*,\s*([-\d.]+)\s*,\s*([\d.]+)\s*,\s*([-\d.]+)\s*\)/);
      if (cbMatch) {
        const [, , y1, , y2] = cbMatch.map(Number);
        if (y1 > 1 || y1 < 0 || y2 > 1 || y2 < 0) pattern = 'spring-like';
      }
    }
    return { value: e, pattern };
  });

  // Detect bounce keyframes (return to start value)
  for (const kf of enhancedKeyframes) {
    const firstStep = kf.steps.find(s => s.offset === '0%' || s.offset === 'from');
    const lastStep = kf.steps.find(s => s.offset === '100%' || s.offset === 'to');
    kf.isBounce = !!(firstStep && lastStep && firstStep.style === lastStep.style && kf.steps.length > 2);
  }

  return {
    transitions: [...transitionSet],
    easings: classifiedEasings,
    durations: [...durationSet],
    keyframes: enhancedKeyframes,
    transitionProperties: sortedProps,
    animationNames: [...animationNames],
  };
}
