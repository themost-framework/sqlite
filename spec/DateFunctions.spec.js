import { TestApplication } from './TestApplication';
import moment from 'moment';

describe('DateFunctions', () => {
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

    it('should use getDate()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getDate().equal('2019-04-15').silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.orderDate.getDate()).toEqual(15);
                expect(item.orderDate.getMonth()).toEqual(3);
                expect(item.orderDate.getFullYear()).toEqual(2019);
            }
        });
    });

    it('should use getDay()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getDate().getDay().equal(15).silent().take(10).getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                const orderDate = item.orderDate;
                const dayOfMonth = parseInt(moment.utc(orderDate).format('D'), 10);
                expect(dayOfMonth).toEqual(15);
            }
        });
    });

    it('should use getMonth()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getMonth().equal(4).silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                const orderMonth = parseInt(moment.utc(item.orderDate).format('M'), 10);
                expect(orderMonth).toEqual(4);
            }
        });
    });

    it('should use getFullYear()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getFullYear().equal(2019)
                .flatten().silent().getItems();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                const fullYear = item.orderDate.getFullYear();
                expect(fullYear).toEqual(2019);
            }
        });
    });

    it('should use getHours()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getHours().equal(14).silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                const hour = parseInt(moment.utc(item.orderDate).format('H'), 10);
                expect(hour).toEqual(14);
            }
        });
    });

    it('should use getMinutes()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getMinutes().equal(45).silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.orderDate.getMinutes()).toEqual(45);
            }
        });
    });

    it('should use getSeconds()', async () => {
        await app.executeInTestTranscaction(async (context) => {
            let items = await context.model('Order')
                .asQueryable().where('orderDate').getSeconds().equal(45).silent().getItems();
            expect(Array.isArray(items)).toBeTruthy();
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item.orderDate.getSeconds()).toEqual(45);
            }
        });
    });

});
