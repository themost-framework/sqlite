
// MOST Web Framework Codename Zero Gravity Copyright (c) 2017-2022, THEMOST LP
import { DataAdapterBase, DataAdapterIndexes, DataAdapterMigration, DataAdapterTable, DataAdapterView } from '@themost/common';

export declare class SqliteAdapter implements DataAdapterBase {
    constructor(options: any);
    rawConnection?: any;
    options?: any;
    selectIdentityAsync(entity: string, attribute: string): Promise<any>;
    static formatType(field: any): string;
    open(callback: (err: Error) => void): void;
    close(callback: (err: Error) => void): void;
    openAsync(): Promise<void>;
    closeAsync(): Promise<void>;
    prepare(query: any, values?: Array<any>): any;
    createView(name: string, query: any, callback: (err: Error) => void): void;
    executeInTransaction(func: any, callback: (err: Error) => void): void;
    executeInTransactionAsync(func: () => Promise<any>): Promise<any>;
    migrate(obj: DataAdapterMigration, callback: (err: Error) => void): void;
    migrateAsync(obj: DataAdapterMigration): Promise<void>;
    selectIdentity(entity: string, attribute: string, callback: (err: Error, value: any) => void): void;
    execute(query: any, values: any, callback: (err: Error, value: any) => void): void;
    executeAsync(query: any, values: any): Promise<any>;
    executeAsync<T>(query: any, values: any): Promise<Array<T>>;
    lastIdentity(callback: (err: Error, value: any) => void): void;
    lastIdentityAsync(): Promise<any>;
    table(table: string): DataAdapterTable;
    view(view: string): DataAdapterView;
    indexes(table: string): DataAdapterIndexes;
}
