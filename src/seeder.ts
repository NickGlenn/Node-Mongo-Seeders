import { Collection, ObjectId, OptionalId } from "mongodb";
import { ok } from "assert";
import * as deepmerge from "deepmerge";
import { isPlainObject } from "is-plain-object";

export type Document = {
  /** All documents will most likely have an _id field. */
  _id?: unknown | ObjectId;
};

type SeedPatcher<T> = Partial<T> | { (data: OptionalId<T>, index: number): OptionalId<T> };

export type FactoryFn<T> = () => OptionalId<T>;

/**
 * Provides functionality for managing seeded data that will be generated and inserted
 * into the database using the provided collection DB instance and factory function.
 */
export class Seeder<T extends Document> {

  /** Collection instance that records will be inserted into. */
  private readonly _col: Collection<T>;

  /** Factory function used to generate new seed records. */
  private readonly _factory: FactoryFn<T>;

  /** IDs of all created seed records. */
  private _inserted: T["_id"][] = [];

  /**
   * Constructs the seeder instance.
   */
  constructor(col: Collection<T>, factory: FactoryFn<T>) {
    this._col = col;
    this._factory = factory;
  }

  /**
   * Constructs 1 or more records with the patch applied and returns the result.
   */
  private _createData(count: number, patch?: SeedPatcher<T>) {
    let records: OptionalId<T>[] = [];

    for (let i = 0; i < count; i++) {
      records.push(this._patch(this._factory(), i, patch));
    }

    return records;
  }

  /**
   * Applies the given seed patcher to the data as appropriate.
   */
  private _patch(record: OptionalId<T>, index: number, patch?: SeedPatcher<T>) {
    if (typeof patch === "function") {
      record = patch(record, index);
    }
    else if (patch !== null && typeof patch === "object") {
      record = deepmerge(record, patch, {
        isMergeableObject: val => (isPlainObject(val) && !Array.isArray(val)),
      }) as OptionalId<T>;
    }

    return record;
  }

  /**
   * Picks a random value in a min/max range and returns it.
   */
  private _randomCount(min: number, max: number): number {
    min = Math.max(0, min);
    ok(max > min, "Max value must be 1 greater than min value.");
    return Math.floor((Math.random() * (max - min)) + min);
  }

  /**
   * Creates and inserts a single record into the database, returning the inserted record.
   */
  public async one(patch?: SeedPatcher<T>): Promise<T> {
    let [data] = this._createData(1, patch);
    if (!data._id) data._id = new ObjectId();
    const result = await this._col.insertOne(data);
    ok(result.acknowledged, "Failed to insert seeded record into DB.");
    this._inserted.push(data._id);
    return data as T;
  }

  /**
   * Creates and inserts 1-n records into the database, returning the inserted records as an array.
   */
  public async many(count: number, patch?: SeedPatcher<T>): Promise<T[]> {
    if (count < 1) { return []; }
    const data = this._createData(count, patch).map(data => ({
      ...data,
      _id: data._id ?? new ObjectId(),
    }));
    const result = await this._col.insertMany(data);
    ok(result.acknowledged, "Failed insert all seeded records into the DB");
    this._inserted = this._inserted.concat(data.map(d => d._id));
    return data as T[];
  }

  /**
   * Creates and inserts a random number of records (within the given range) into the database,
   * returning the inserted records as an array.
   */
  public random(min: number, max: number, patch?: SeedPatcher<T>): Promise<T[]> {
    return this.many(this._randomCount(min, max), patch);
  }

  /**
   * Creates and inserts a random number of records (within the given range) into the databse, picks one
   * to be the "standout" patched object, and then returns the results as tuple.
   */
  public async pick(min: number, max: number, patch: SeedPatcher<T>): Promise<[T, T[]]> {
    const count = this._randomCount(min, max);
    const picked = this._randomCount(0, count);
    const crowd = await this.many(count, (data, index) => {
      if (index === picked) {
        return this._patch(data, index, patch);
      }

      return data;
    });

    const standout = crowd.splice(picked, 1);

    return [standout[0], crowd];
  }

  /**
   * Destroys all inserted records up to this point.
   */
  public async clean() {
    const query: any = { _id: { $in: this._inserted } };
    await this._col.deleteMany(query);
    this._inserted = [];
  }

}