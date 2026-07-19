export const greptileEvidence = {
  viewport: { width: 1280, height: 800 },
  headings: [{
    selector: 'h1', text: 'Build software with confidence', visible: true,
    rect: { x: 96, y: 172, width: 760, height: 150 },
    style: {
      color: 'rgb(61, 59, 79)', backgroundColor: 'rgba(0, 0, 0, 0)',
      fontFamily: 'Anybody, sans-serif', fontSize: '72px', fontWeight: '700',
      lineHeight: '76px', letterSpacing: '-1.44px', borderRadius: '0px',
      borderWidth: '0px', borderColor: 'rgba(0, 0, 0, 0)', clipPath: 'none',
    },
  }],
  bodyText: [{
    selector: 'main p', text: 'AI code review for engineering teams', visible: true,
    rect: { x: 96, y: 350, width: 560, height: 58 },
    style: {
      color: 'rgb(61, 59, 79)', backgroundColor: 'rgba(0, 0, 0, 0)',
      fontFamily: 'DM Sans, sans-serif', fontSize: '18px', fontWeight: '400',
      lineHeight: '29px', letterSpacing: 'normal', borderRadius: '0px',
      borderWidth: '0px', borderColor: 'rgba(0, 0, 0, 0)', clipPath: 'none',
    },
  }],
  labels: [{
    selector: '.eyebrow', text: 'CODE INTELLIGENCE', visible: true,
    rect: { x: 96, y: 132, width: 180, height: 18 },
    style: {
      color: 'rgb(61, 59, 79)', backgroundColor: 'rgba(0, 0, 0, 0)',
      fontFamily: 'Space Mono, monospace', fontSize: '12px', fontWeight: '400',
      lineHeight: '18px', letterSpacing: '0.72px', borderRadius: '0px',
      borderWidth: '0px', borderColor: 'rgba(0, 0, 0, 0)', clipPath: 'none',
    },
  }],
  actions: [
    {
      selector: 'nav a.cta', text: 'Get started', scope: 'nav', visible: true,
      rect: { x: 1088, y: 24, width: 112, height: 44 },
      style: {
        color: 'rgb(61, 59, 79)', backgroundColor: 'rgb(40, 233, 159)',
        fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: '600',
        lineHeight: '20px', letterSpacing: 'normal', borderRadius: '0px',
        borderWidth: '0px', borderColor: 'rgba(0, 0, 0, 0)',
        clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
      },
    },
    {
      selector: 'main a.cta', text: 'Book a demo', scope: 'main', visible: true,
      rect: { x: 96, y: 444, width: 146, height: 48 },
      style: {
        color: 'rgb(61, 59, 79)', backgroundColor: 'rgb(40, 233, 159)',
        fontFamily: 'DM Sans, sans-serif', fontSize: '15px', fontWeight: '600',
        lineHeight: '22px', letterSpacing: 'normal', borderRadius: '0px',
        borderWidth: '0px', borderColor: 'rgba(0, 0, 0, 0)',
        clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
      },
    },
  ],
  cards: [
    {
      selector: '.feature-card:nth-of-type(1)', visible: true,
      rect: { x: 96, y: 980, width: 340, height: 260 },
      style: {
        color: 'rgb(61, 59, 79)', backgroundColor: 'rgb(245, 244, 237)',
        fontFamily: 'DM Sans, sans-serif', fontSize: '16px', fontWeight: '400',
        lineHeight: '24px', letterSpacing: 'normal', borderRadius: '0px',
        borderWidth: '1px', borderColor: 'rgb(61, 59, 79)', clipPath: 'none',
      },
    },
    {
      selector: '.feature-card:nth-of-type(2)', visible: true,
      rect: { x: 460, y: 980, width: 340, height: 260 },
      style: {
        color: 'rgb(61, 59, 79)', backgroundColor: 'rgb(245, 244, 237)',
        fontFamily: 'DM Sans, sans-serif', fontSize: '16px', fontWeight: '400',
        lineHeight: '24px', letterSpacing: 'normal', borderRadius: '0px',
        borderWidth: '1px', borderColor: 'rgb(61, 59, 79)', clipPath: 'none',
      },
    },
  ],
  surfaces: [
    { selector: 'body', order: 0, rect: { width: 1280, height: 2400 }, style: { backgroundColor: 'rgb(245, 244, 237)', color: 'rgb(61, 59, 79)' } },
    { selector: 'main section:nth-of-type(2)', order: 1, rect: { width: 1280, height: 720 }, style: { backgroundColor: 'rgb(61, 59, 79)', color: 'rgb(245, 244, 237)' } },
    { selector: 'main section:nth-of-type(3)', order: 2, rect: { width: 1280, height: 680 }, style: { backgroundColor: 'rgb(245, 244, 237)', color: 'rgb(61, 59, 79)' } },
  ],
  animations: [
    { name: 'float-code', target: '.code-window', duration: 6000, easing: 'ease-in-out', iterations: Infinity, playState: 'running' },
    { name: 'grid-drift', target: '.background-grid', duration: 40000, easing: 'linear', iterations: Infinity, playState: 'running' },
  ],
};
