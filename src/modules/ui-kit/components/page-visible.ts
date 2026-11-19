import { createContext, useContext } from 'react';

/** True while the page holding this component is the one shown. The app frame provides it (WS-41). */
export const PageVisibleContext = createContext(true);

/** Whether this panel's page is shown; a hidden page's panels pause their own drawing (WS-41). */
export function usePageVisible(): boolean {
  return useContext(PageVisibleContext);
}
