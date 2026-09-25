import { z } from 'zod';
import { type Brand } from './brand';

export type Money = Brand<number, 'Money'>;

export const moneySchema = z.int().transform((minorUnits): Money => minorUnits as Money);
