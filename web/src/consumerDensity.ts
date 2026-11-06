import { useLayoutEffect } from 'react';
import './consumer-density.css';

let consumers = 0;
let addedMarker = false;

/** Includes body portals without applying customer typography to the admin root. */
export function useConsumerDensity() {
  useLayoutEffect(() => {
    if (consumers++ === 0) {
      addedMarker = !document.body.classList.contains('spotlog-consumer');
      document.body.classList.add('spotlog-consumer');
    }
    return () => {
      if (--consumers === 0 && addedMarker) {
        document.body.classList.remove('spotlog-consumer');
        addedMarker = false;
      }
    };
  }, []);
}
