import { DataConfigurationStrategy } from '@themost/data';
import { TestApplication } from './TestApplication';

describe('SqliteAdapter.migrate', () => {
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
    
    it('should migrate table and change column size', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const service = app.configuration.getStrategy(DataConfigurationStrategy);
            const modelDefinition = service.getModelDefinition('VisitorActivity');
            modelDefinition.fields.find((x) => x.name === 'visitorBrowser').size = 36;
            modelDefinition.version = '3.0.0';
            service.setModelDefinition('VisitorActivity', modelDefinition);
            delete app.configuration.cache;
            let columns = await context.db.table('VisitorActivityBase').columnsAsync();
            let column = columns.find((x) => x.name === 'visitorBrowser');
            expect(column).toBeTruthy();
            expect(column.size).toBeFalsy();
            const count = await context.model('VisitorActivity').asQueryable().silent().count();
            await context.model('VisitorActivity').migrateAsync();
            columns = await context.db.table('VisitorActivityBase').columnsAsync();
            column = columns.find((x) => x.name === 'visitorBrowser');
            expect(column).toBeTruthy();
            expect(column.size).toEqual(36);
            const newCount = await context.model('VisitorActivity').asQueryable().silent().count();
            expect(newCount).toBeTruthy();
            expect(newCount).toEqual(count);
        });
    });

    it('should migrate table and remove column', async () => {
        await app.executeInTestTranscaction(async (context) => {
            const service = app.configuration.getStrategy(DataConfigurationStrategy);
            const modelDefinition = service.getModelDefinition('VisitorActivity');
            const findIndex = modelDefinition.fields.findIndex((x) => x.name === 'visitor');
            modelDefinition.fields.splice(findIndex, 1);
            modelDefinition.version = '3.0.0';
            service.setModelDefinition('VisitorActivity', modelDefinition);
            delete app.configuration.cache;
            let columns = await context.db.table('VisitorActivityBase').columnsAsync();
            let column = columns.find((x) => x.name === 'visitor');
            expect(column).toBeTruthy();
            const count = await context.model('VisitorActivity').asQueryable().silent().count();
            await context.model('VisitorActivity').migrateAsync();
            columns = await context.db.table('VisitorActivityBase').columnsAsync();
            column = columns.find((x) => x.name === 'visitor');
            expect(column).toBeFalsy();
            const newCount = await context.model('VisitorActivity').asQueryable().silent().count();
            expect(newCount).toBeTruthy();
            expect(newCount).toEqual(count);
        });
    });

});