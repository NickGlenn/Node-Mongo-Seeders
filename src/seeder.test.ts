import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import { Seeder } from "./seeder";

let conn: MongoClient;
let db: Db;
let collection: Collection;
let seeder: Seeder<any>;

const factory = jest.fn(() => ({
  foo: Math.round(Math.random() * 99999999),
  bar: Math.random() > 0.5,
  baz: Array.from({ length: Math.ceil(Math.random() * 99) }, () => Math.floor(Math.random() * 9999)),
}));

beforeAll(async () => {
  conn = await MongoClient.connect("mongodb://localhost");
  if (!conn) {
    throw new Error("Failed to connect to MongoDB");
  }

  db = conn.db("seeder-lib-testing");
  collection = db.collection("tests");
});

beforeEach(() => {
  seeder = new Seeder(collection, factory);
});

afterEach(async () => {
  factory.mockClear();
  await collection.deleteMany({});
});

afterAll(async () => {
  await db.dropDatabase();
  await conn.close();
});


describe("Seeder.one", () => {

  it("creates and returns a record using the factory function", async () => {
    const record = await seeder.one();

    // perform assertions on returned value
    expect(typeof record).toBe("object");
    expect(typeof record.foo).toBe("number");
    expect(typeof record.bar).toBe("boolean");
    expect(record.baz).toBeInstanceOf(Array);
    expect(factory).toBeCalledTimes(1);
  });

  it("automatically adds _id property as type of ObjectId in return value", async () => {
    const record = await seeder.one();

    // did we get a new ObjectId from the inserted record?
    expect(record._id).toBeInstanceOf(ObjectId);
  });

  it("creates and inserts a single record into the database", async () => {
    const record = await seeder.one();

    // find the record in the database or fail
    const found = await collection.findOne({ _id: record._id });
    expect(found).toMatchObject(record);
  });

  it("applies the patch object on top of the created record", async () => {
    const record = await seeder.one({
      _id: new ObjectId(),
      foo: 1,
      baz: [1, 2, 3],
    });

    // make sure that foo and baz match the patched values
    expect(record.foo).toBe(1);
    expect(typeof record.bar).toBe("boolean");
    expect(record.baz).toMatchObject([1, 2, 3]);

    // ensure that the record in the database matches the patched value
    const found = await collection.findOne({ _id: record._id });
    expect(found).toMatchObject(record);
  });

  it.todo("applies the returned value from the patch function instead of the created record");

  it("correctly patches `null` on top of the created record", async () => {
    const record = await seeder.one({
      _id: new ObjectId(),
      foo: null,
      baz: [1, 2, 3],
    });

    // make sure that foo and baz match the patched values
    expect(record.foo).toBe(null);
    expect(typeof record.bar).toBe("boolean");
    expect(record.baz).toMatchObject([1, 2, 3]);

    // ensure that the record in the database matches the patched value
    const found = await collection.findOne({ _id: record._id });
    expect(found).toMatchObject(record);
  });

});

describe("Seeder.many", () => {

  it("returns an empty array if count is 0", async () => {
    const records = await seeder.many(0);

    expect(records).toMatchObject([]);
  });

  it("creates and returns the specified number of items when a count is provided", async () => {
    const count = 20;
    const records = await seeder.many(count);

    expect(records.length).toBe(count);
    expect(factory).toBeCalledTimes(count);

    // ensure that the records are in the database
    // const $in = records.map(r => r._id);
    const found = await collection.find({}).toArray();
    expect(found).toMatchObject(expect.arrayContaining(records));
  });

  it("applies a patch object to each created record", async () => {
    const count = 15;
    const records = await seeder.many(count, {
      _foreignKey: new ObjectId(),
    });

    expect(records.length).toBe(count);
    expect(factory).toBeCalledTimes(count);

    // ensure that the records are in the database
    // const $in = records.map(r => r._id);
    const found = await collection.find({}).toArray();
    expect(found).toMatchObject(expect.arrayContaining(records));
  });

  it.todo("applies a patch function each created record");

});

describe("Seeder.random", () => { });

describe("Seeder.pick", () => { });

describe("Seeder.clean", () => {

  it("only removes records created using the seeder instance", async () => {
    const record = await seeder.one();
    const records = await seeder.many(5);

    // insert some other records
    const write = await collection.insertMany([factory(), factory(), factory()]);
    expect(write.insertedCount).toBe(3);

    // ensure that the records are in the database
    const $in = records.map(r => r._id).concat(record._id);
    const found = await collection.find({ _id: { $in } }).toArray();
    expect(found).toHaveLength(6);
    expect(found).toMatchObject(expect.arrayContaining(records));

    // run the clean method
    await seeder.clean();

    // check that the records we created are gone
    const foundCount = await collection.count({ _id: { $in } });
    expect(foundCount).toBe(0);
  });

});