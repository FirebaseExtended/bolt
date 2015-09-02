#!/usr/bin/env python
#
# Copyright 2015 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import print_function

import sys
import json


def main():
  data = json.load(sys.stdin)
  lines = []
  extract_values(data, '', lines)
  lines.sort()
  print('\n'.join(lines))


def extract_values(j, base, lines):
  if type(j) is dict:
    for p in j:
      extract_values(j[p], base + '/' + p, lines)
    return

  if type(j) is list:
    for i in range(len(j)):
      extract_values(j[i], base + '/' + str(i), lines)
    return

  lines.append(base + ': ' + str(j))


if __name__ == '__main__':
  main()
