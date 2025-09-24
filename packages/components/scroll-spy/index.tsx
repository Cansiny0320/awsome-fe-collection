import * as React from 'react';

export type ScrollSpyProps = React.PropsWithChildren<{
  onActiveChange?: (index: number) => void;
  onInViewChange?: (isInViewArr: boolean[]) => void;
  rootMargin?: IntersectionObserverInit['rootMargin'];
  topOffset?: number;
  root?: IntersectionObserverInit['root'];
}>;

export type ScrollSpyRef = {
  scrollTo?: (options: {
    idx: number;
    topOffset?: number;
    smooth?: boolean;
    root?: HTMLElement | null;
  }) => void;
};

export const ScrollSpy = React.forwardRef<ScrollSpyRef, ScrollSpyProps>(
  (
    {
      children,
      onActiveChange,
      onInViewChange,
      rootMargin = '0px',
      topOffset,
      root = null,
    },
    ref,
  ) => {
    const inViewRef = React.useRef<boolean[]>([]);
    const skipObserverRef = React.useRef(false);
    const domRef = React.useRef<HTMLDivElement[]>([]);

    React.useEffect(() => {
      if (!domRef.current.length) {
        return () => {};
      }

      const observer = new IntersectionObserver(
        (changeList) => {
          changeList.forEach((item) => {
            const idx = domRef.current.indexOf(item.target as HTMLDivElement);
            inViewRef.current[idx] = item.isIntersecting;
          });

          if (skipObserverRef.current) {
            skipObserverRef.current = false;
            return;
          }

          onInViewChange?.(inViewRef.current);

          const activeIndex = inViewRef.current.indexOf(true);
          onActiveChange?.(activeIndex >= 0 ? activeIndex : 0);
        },
        { rootMargin, root },
      );

      domRef.current.forEach((dom) => observer.observe(dom));

      return () => {
        observer.disconnect();
      };
    }, [rootMargin, root, children, onActiveChange, onInViewChange]);

    React.useImperativeHandle(
      ref,
      () => ({
        scrollTo: (options) => {
          const { idx, smooth = false } = options;

          const targetDom = domRef.current[idx]
            ?.childNodes[0] as HTMLDivElement;

          if (targetDom) {
            skipObserverRef.current = true;

            targetDom.scrollIntoView({
              behavior: smooth ? 'smooth' : undefined,
              block: 'start',
            });

            if (!smooth) {
              onActiveChange?.(idx);
            }
          }
        },
      }),
      [onActiveChange],
    );

    if (!children) {
      return null;
    }

    let childrenArray = children;
    if (!Array.isArray(childrenArray)) {
      childrenArray = [childrenArray];
    }

    return (
      <>
        {(childrenArray as React.ReactNode[])
          .filter(Boolean)
          .map((child, idx) => {
            return (
              <div
                ref={(el) => {
                  if (!el || domRef.current.includes(el)) return;
                  inViewRef.current.push(true);
                  domRef.current[idx] = el as HTMLDivElement;
                }}
                key={idx}
              >
                {topOffset !== undefined && (
                  <div
                    style={{
                      top: topOffset,
                      height: '0',
                      position: 'relative',
                    }}
                  />
                )}
                {child}
              </div>
            );
          })}
      </>
    );
  },
);

ScrollSpy.displayName = 'ScrollSpy';
