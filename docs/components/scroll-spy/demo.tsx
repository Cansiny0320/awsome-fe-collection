import * as React from 'react';
import {
  ScrollSpy,
  type ScrollSpyRef,
} from '../../../packages/components/scroll-spy';

import './demo.less';
import clsx from 'clsx';

const Demo = () => {
  const scrollSpyRef = React.useRef<ScrollSpyRef>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  return (
    <div className="container">
      <div className="tab">
        {Array(10)
          .fill(0)
          .map((_, idx) => (
            <div
              className={clsx('tab-item', {
                active: activeIndex === idx,
              })}
              key={idx}
              onClick={() => {
                scrollSpyRef.current?.scrollTo?.({
                  idx,
                });
              }}
            >
              {idx}
            </div>
          ))}
      </div>
      <ScrollSpy onActiveChange={setActiveIndex} ref={scrollSpyRef}>
        {Array(10)
          .fill(0)
          .map((_, idx) => (
            <div className="card" key={idx}>
              {idx}
            </div>
          ))}
      </ScrollSpy>
    </div>
  );
};

export default Demo;
