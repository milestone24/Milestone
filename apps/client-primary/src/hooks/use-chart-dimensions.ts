import { useEffect, useState, type RefObject } from "react";
import {
  createChartDimensions,
  type ChartDimensions,
  type ChartDimensionsOptions,
} from "@milestone/js-common/react/chart/types";

export type { ChartDimensions, ChartDimensionsOptions };

export function useChartDimensions(
  containerRef: RefObject<HTMLDivElement>,
  options: ChartDimensionsOptions = {}
): ChartDimensions {
  const {
    height = 240,
    marginTop = 20,
    marginRight = 20,
    marginBottom = 40,
    marginLeft = 60,
  } = options;

  const [dimensions, setDimensions] = useState<ChartDimensions>(() =>
    createChartDimensions(0, options)
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) return;

      const { width: containerWidth } = entries[0].contentRect;
      setDimensions(
        createChartDimensions(containerWidth, {
          height,
          marginTop,
          marginRight,
          marginBottom,
          marginLeft,
        })
      );
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, height, marginTop, marginRight, marginBottom, marginLeft]);

  return dimensions;
}
