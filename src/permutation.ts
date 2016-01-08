/*
 * AST builders for Firebase Rules Language.
 *
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Usage:
 *
 *   for(i = new Iterator(); i.current(); t.next()) { ... }
 */
export interface Iterator<T> {
  current(): T;
  next(): void;
}

export class IndexPermutation implements Iterator<number[]> {
  private values: number[] = [];
  private locations: number[] = [];
  private remaining: number;

  constructor(private n: number, private k?: number) {
    if (k === undefined) {
      this.k = n;
    }
    if (k > n) {
      throw new Error("Illegal permutation size " + k + " > " + n);
    }
    for (let i = 0; i < this.k; i++) {
      this.set(i, i);
    }
    this.remaining = this.getCount() - 1;
  }

  getCount(): number {
    let count = 1;
    for (let i = 0; i < this.k; i++) {
      count *= this.n - i;
    }
    return count;
  }

  current(): number[] {
    if (this.values === null) {
      return null;
    }
    return this.values.slice();
  }

  next() {
    if (this.remaining === 0) {
      this.values = null;
    }
    if (this.values === null) {
      return;
    }
    this.advance();
  }

  private advance() {
    let location = this.k - 1;
    for (; location >= 0; location--) {
      let value = this.nextValue(location, this.values[location] + 1);
      this.set(location, value);
      if (value !== undefined) {
        break;
      }
    }
    for (location += 1; location < this.k; location++) {
      this.set(location, this.nextValue(location, 0));
    }
    this.remaining -= 1;
  }

  private set(location: number, value?: number) {
    let oldValue = this.values[location];
    if (oldValue !== undefined) {
      this.locations[oldValue] = undefined;
    }
    this.values[location] = value;
    if (value !== undefined) {
      this.locations[value] = location;
    }
  }

  private nextValue(location: number, minValue: number): number {
    for (let value = minValue; value < this.n; value++) {
      if (this.locations[value] === undefined || this.locations[value] > location) {
        return value;
      }
    }
    return undefined;
  }
}

export class Permutation<T> implements Iterator<T[]> {
  collection: T[];
  p: IndexPermutation;

  constructor(collection: T[], k?: number) {
    this.p = new IndexPermutation(collection.length, k);
    this.collection = collection.slice();
  }

  getCount(): number {
    return this.p.getCount();
  }

  current(): T[] {
    let indexes = this.p.current();
    if (indexes === null) {
      return null;
    }
    return indexes.map((i) => {
      return this.collection[i];
    });
  }

  next() {
    this.p.next();
  }
}
