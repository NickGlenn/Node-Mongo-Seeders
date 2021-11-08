import { Db } from "mongodb";
import { FactoryFn, Seeder } from "./seeder";

export type FactoryMap = {
  [key: string]: FactoryFn<unknown>;
};

export type SeederFactory<T> = (db: Db) => Seeder<T>;

export type SeederMapFactory<M extends FactoryMap> = (db: Db) => SeederMap<M>;

export type Seeders<M extends {}> = {
  [collection in keyof M]: Seeder<M[collection]>;
} & {
  /** Cleans up the seeded data created by any of the seeders in this map. */
  clean(): Promise<void>;
};

export type SeederMap<M extends FactoryMap> = {
  [collection in keyof M]: Seeder<ReturnType<M[collection]>>;
} & {
  /** Cleans up the seeded data created by any of the seeders in this map. */
  clean(): Promise<void>;
};

/**
 * Creates a map of seeder instances to represent a database.
 */
export function createSeederMap<M extends FactoryMap>(seeders: M): SeederMapFactory<M> {
  return (db: Db) => {
    let output: { [key: string]: Seeder<{}> } = {};

    for (let key in seeders) {
      output[key] = new Seeder(db.collection(key), seeders[key]);
    }

    const clean = async () => {
      for (let key in output) {
        await output[key].clean();
      }
    };

    return { ...output, clean } as SeederMap<M>;
  };
}

/**
 * Factory function for creating a seeder.
 */
export function createSeeder<T extends {}>(collection: string, factory: FactoryFn<T>): SeederFactory<T> {
  return (db: Db) => {
    return new Seeder<T>(db.collection<T>(collection), factory);
  };
}