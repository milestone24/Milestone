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

export type ChartDimensionsOptions = {
  height?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
};

export function createChartDimensions(
  containerWidth: number,
  options: ChartDimensionsOptions = {}
): ChartDimensions {
  const {
    height = 240,
    marginTop = 20,
    marginRight = 20,
    marginBottom = 40,
    marginLeft = 60,
  } = options;

  const boundedWidth = Math.max(0, containerWidth - marginLeft - marginRight);
  const boundedHeight = Math.max(0, height - marginTop - marginBottom);

  return {
    width: containerWidth,
    height,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    boundedWidth,
    boundedHeight,
  };
}
