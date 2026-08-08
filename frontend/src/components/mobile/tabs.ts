export type TabId = 'today' | 'calendar' | 'give' | 'more';

export interface TabDef {
  id: TabId;
  /** Dot-path key into the i18n dictionaries. */
  labelKey: string;
  /** Where the tab goes for a signed-in member. */
  authedPath: string;
  /** Where it goes for a signed-out visitor. */
  publicPath: string;
  /** Pathnames that light this tab. */
  matches: string[];
}

export const TABS: TabDef[] = [
  {
    id: 'today',
    labelKey: 'mobileNav.today',
    authedPath: '/dashboard',
    publicPath: '/',
    matches: ['/', '/dashboard']
  },
  {
    id: 'calendar',
    labelKey: 'mobileNav.calendar',
    authedPath: '/calendar',
    publicPath: '/calendar',
    matches: ['/calendar']
  },
  {
    id: 'give',
    labelKey: 'mobileNav.give',
    authedPath: '/donate',
    publicPath: '/donate',
    // Everything a member reaches while giving keeps the tab lit, so the bar
    // does not appear to lose its place mid-payment.
    matches: ['/donate', '/pledge', '/dues', '/thank-you']
  },
  {
    id: 'more',
    labelKey: 'mobileNav.more',
    authedPath: '',
    publicPath: '',
    matches: []
  }
];

/**
 * More is the catch-all: any route not explicitly claimed lights it, so the bar
 * is never blank on the app's twenty-odd remaining routes.
 */
export const resolveActiveTab = (pathname: string): TabId => {
  const hit = TABS.find((tab) => tab.matches.includes(pathname));
  return hit ? hit.id : 'more';
};
