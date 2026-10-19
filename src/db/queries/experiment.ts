import type { Experiment } from '../../domain/types';
import { db } from '../db';

export function queryExperiments(): Promise<Experiment[]> {
  return db.experiments.orderBy('startDate').toArray();
}
