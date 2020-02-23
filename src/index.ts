import * as mongo from "mongodb";
import { FactoryFn, Seeder } from "./seeder";

type FactoryMap = {
  [key: string]: FactoryFn<unknown>;
};

type SeederFactory<T> = (db: mongo.Db) => Seeder<T>;

type SeederMapFactory<M extends FactoryMap> = (db: mongo.Db) => SeederMap<M>;

export type Seeders<M extends {}> = {
  [collection in keyof M]: Seeder<M[collection]>;
};

export type SeederMap<M extends FactoryMap> = {
  [collection in keyof M]: Seeder<ReturnType<M[collection]>>;
};

/**
 * Creates a map of seeder instances to represent a database.
 */
export function createSeederMap<M extends FactoryMap>(seeders: M): SeederMapFactory<M> {
  return (db: mongo.Db) => {
    let output: { [key: string]: Seeder<{}> } = {};

    for (let key in seeders) {
      output[key] = new Seeder(db.collection(key), seeders[key]);
    }

    return output as SeederMap<M>;
  };
}

/**
 * Factory function for creating a seeder.
 */
export function createSeeder<T extends {}>(collection: string, factory: FactoryFn<T>): SeederFactory<T> {
  return (db: mongo.Db) => {
    return new Seeder<T>(db.collection<T>(collection), factory);
  };
}