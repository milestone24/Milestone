import { FieldValues, Resolver } from "react-hook-form";

export const withTransform =
  <TFieldValues extends FieldValues, TContext>(
    resolver: Resolver<TFieldValues, TContext>,
    transform: (values: TFieldValues) => TFieldValues,
  ): Resolver<TFieldValues, TContext> => {
    return (values, context, options) => {
      return resolver(transform(values), context, options);
    };
  };
