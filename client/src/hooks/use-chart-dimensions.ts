import { useEffect, useState, RefObject } from "react";

export type ChartDimensions = {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  boundedWidth: number;
  boundedHeight: number;
};

type UseChartDimensionsOptions = {
  height?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
};

export function useChartDimensions(
  containerRef: RefObject<HTMLDivElement>,
  options: UseChartDimensionsOptions = {}
): ChartDimensions {
  const {
    height = 240,
    marginTop = 20,
    marginRight = 20,
    marginBottom = 40,
    marginLeft = 60,
  } = options;

  const [dimensions, setDimensions] = useState<ChartDimensions>({
    width: 0,
    height,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    boundedWidth: 0,
    boundedHeight: 0,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) return;

      const { width: containerWidth } = entries[0].contentRect;
      const boundedWidth = Math.max(0, containerWidth - marginLeft - marginRight);
      const boundedHeight = Math.max(0, height - marginTop - marginBottom);

      setDimensions({
        width: containerWidth,
        height,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        boundedWidth,
        boundedHeight,
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, height, marginTop, marginRight, marginBottom, marginLeft]);

  return dimensions;
}
