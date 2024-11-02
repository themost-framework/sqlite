// MOST Web Framework Codename Zero Gravity Copyright (c) 2017-2022, THEMOST LP
import {SqliteAdapter} from './SqliteAdapter';
export * from './SqliteAdapter';
export * from './SqliteFormatter';
export declare function createInstance(options: { database: string, extensions?: { [key: string]: string }, retry?: number, retryInterval?: number }): SqliteAdapter;