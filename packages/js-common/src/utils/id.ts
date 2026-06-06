import { nanoid } from "nanoid";

export const generateId = (size: number = 8) => {
  return nanoid(size); //8 characters is a good balance between uniqueness and readability
};