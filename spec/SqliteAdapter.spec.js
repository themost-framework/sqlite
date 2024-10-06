import { QueryExpression } from '@themost/query';
import { SqliteFormatter } from '../src/SqliteFormatter';
import { TestApplication } from './TestApplication';

describe('SqliteAdapter', () => {
    /**
     * @type {TestApplication}
     */
    let app;
    beforeAll(async () => {
        app = new TestApplication(__dirname);
    });
    beforeEach(async () => {
        //
    });
    afterAll(async () => {
        await app.finalize();
    });
    afterEach(async () => {
        //
    });
    
    it('should check table', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const exists = await context.db.table('Table1').existsAsync();
            expect(exists).toBeFalsy();
        });
    });

    it('should create table', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const db = context.db;
            let exists = await db.table('Table1').existsAsync();
            expect(exists).toBeFalsy();
            await context.db.table('Table1').createAsync([
                {
                    name: 'id',
                    type: 'Counter',
                    primary: true,
                    nullable: false
                },
                {
                    name: 'name',
                    type: 'Text',
                    size: 255,
                    nullable: false
                },
                {
                    name: 'description',
                    type: 'Text',
                    size: 255,
                    nullable: true
                }
            ]);
            exists = await db.table('Table1').existsAsync();
            expect(exists).toBeTruthy();
            // get columns
            const columns = await db.table('Table1').columnsAsync();
            expect(Array.isArray(columns)).toBeTruthy();
            let column = columns.find((col) => col.name === 'id');
            expect(column).toBeTruthy();
            expect(column.nullable).toBeFalsy();
            column = columns.find((col) => col.name === 'description');
            expect(column).toBeTruthy();
            expect(column.nullable).toBeTruthy();
            expect(column.size).toBe(255);
            await db.executeAsync(`DROP TABLE ${new SqliteFormatter().escapeName('Table1')}`);
        });
    });

    it('should create view', async () => {

        await app.executeInTestTranscaction(async (context) => {
            const db = context.db;
            let exists = await db.table('Table1').existsAsync();
            expect(exists).toBeFalsy();
            await db.table('Table1').createAsync([
                {
                    name: 'id',
                    type: 'Counter',
                    primary: true,
                    nullable: false
                },
                {
                    name: 'name',
                    type: 'Text',
                    size: 255,
                    nullable: false
                },
                {
                    name: 'description',
                    type: 'Text',
                    size: 255,
                    nullable: true
                }
            ]);
            exists = await db.table('Table1').existsAsync();
            expect(exists).toBeTruthy();

            exists = await db.view('View1').existsAsync();
            expect(exists).toBeFalsy();

            const query = new QueryExpression().select('id', 'name', 'description').from('Table1');
            await db.view('View1').createAsync(query);

            exists = await db.view('View1').existsAsync();
            expect(exists).toBeTruthy();

            await db.view('View1').dropAsync();

            exists = await db.view('View1').existsAsync();
            expect(exists).toBeFalsy();
        });
    });

    it('should create index', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const db = context.db;
            let exists = await db.table('Table1').existsAsync();
            expect(exists).toBeFalsy();
            await db.table('Table1').createAsync([
                {
                    name: 'id',
                    type: 'Counter',
                    primary: true,
                    nullable: false
                },
                {
                    name: 'name',
                    type: 'Text',
                    size: 255,
                    nullable: false
                },
                {
                    name: 'description',
                    type: 'Text',
                    size: 255,
                    nullable: true
                }
            ]);
            exists = await db.table('Table1').existsAsync();
            expect(exists).toBeTruthy();

            let list = await db.indexes('Table1').listAsync();
            expect(Array.isArray(list)).toBeTruthy();
            exists = list.findIndex((index) => index.name === 'idx_name') < 0;

            await db.indexes('Table1').createAsync('idx_name', [
                'name'
            ]);

            list = await db.indexes('Table1').listAsync();
            expect(Array.isArray(list)).toBeTruthy();
            exists = list.findIndex((index) => index.name === 'idx_name') >= 0;
            expect(exists).toBeTruthy();

            await db.indexes('Table1').dropAsync('idx_name');

            list = await db.indexes('Table1').listAsync();
            expect(Array.isArray(list)).toBeTruthy();
            exists = list.findIndex((index) => index.name === 'idx_name') >= 0;
            expect(exists).toBeFalsy();

            await db.executeAsync(`DROP TABLE ${new SqliteFormatter().escapeName('Table1')}`);
        });
    });

    it('should retry when busy', async () => {
        await Promise.all([
            new Promise((resolve, reject) => {
                void setTimeout(() => {
                    app.executeInTestTranscaction(async (context) => {
                        const item = await context.model('ActionStatusType').where('alternateName').equal('ActiveActionStatus').getItem();
                        expect(item).toBeTruthy();
                        await context.model('ActionStatusType').silent().save(item);
                        await new Promise((resolveTimeout) => {
                            setTimeout(() => {
                                resolveTimeout();
                            }, 500);
                        })
                    }).then(() => {
                        return resolve();
                    }).catch((err) => {
                        return reject(err);
                    })
                }, 750)
            }),
            new Promise((resolve, reject) => {
                void setTimeout(() => {
                    app.executeInTestTranscaction(async (context) => {
                        const item = await context.model('ActionStatusType').where('alternateName').equal('ActiveActionStatus').getItem();
                        expect(item).toBeTruthy();
                    }).then(() => {
                        return resolve();
                    }).catch((err) => {
                        return reject(err);
                    })
                }, 1000)
            })
        ])
    });


});