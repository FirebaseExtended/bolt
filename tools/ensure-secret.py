#!/usr/bin/env python
# ensure-secret.py --- Initialize a js module file with Firebase secret.
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

import argparse
import webbrowser
import json

HOST='firebaseio.com'

def main():
  parser = argparse.ArgumentParser()
  parser.add_argument("file", help="Secrets file")
  args = parser.parse_args()

  try:
    with open(args.file) as f:
      print("Secrets file, {filename} already exists.".format(filename=args.file))
      return
  except IOError:
    print("{0} does not exist.".format(args.file))
    app_name = raw_input("Firebase app: ")
    secrets_url = 'https://console.firebase.google.com/project/{app}/settings/database'.format(app=app_name)
    print("Copy app secret from %s ..." % secrets_url)
    webbrowser.open(secrets_url)
    print("(if using Firebase 2.0 database, find app secret at: https://{app}.{host}?page=Admin)"\
          .format(app=app_name, host=HOST))
    secret = raw_input("Firebase Secret: ")
    data = {
      'APP': app_name,
      'SECRET': secret
    }
    with open(args.file, 'w') as f:
      f.write("module.exports = {json};\n".format(json=json.dumps(data, indent=2, separators=(',', ': '))))


if __name__ == '__main__':
  main()
