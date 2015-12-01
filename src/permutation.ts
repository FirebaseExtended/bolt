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
/// <reference path="typings/node.d.ts" />

export class Permutation {
  current: number[] = [];
  locations: number[] = [];
  remaining: number;

  constructor(private n: number, private k?: number) {
    if (k === undefined) {
      this.k = n;
    }
    this.remaining = 1;
    for (let i = 0; i < this.k; i++) {
      this.set(i, i);
      this.remaining *= n - i;
    }
    this.remaining -= 1;
  }

  getCurrent(): number[] {
    if (this.current === null) {
      return null;
    }
    return this.current.slice();
  }

  next(): number[] {
    if (this.remaining === 0) {
      this.current = null;
    }
    if (this.current === null) {
      return null;
    }
    this.advance();
    return this.current;
  }

  private advance() {
    let location = this.k - 1;
    for (; location >= 0; location--) {
      let value = this.nextValue(location, this.current[location] + 1);
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
    let oldValue = this.current[location];
    if (oldValue !== undefined) {
      this.locations[oldValue] = undefined;
    }
    this.current[location] = value;
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
