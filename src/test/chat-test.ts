/*
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
import {rulesSuite} from '../simulator';
let secrets = require('../../auth-secrets');

rulesSuite("Chat", function(test) {
  var uid = test.uid;

  test.database(secrets.APP, secrets.SECRET);
  test.rules('samples/chat');

  function makeMikesRoom(rules) {
    return rules
      .as('mike')
      .at('/rooms/mikes-room')
      .write({
        name: "Mike's room",
        creator: uid('mike'),
      });
  }

  test("Create and Delete Room.", function(rules) {
    makeMikesRoom(rules)
      .succeeds("Create empty room.")

      .as('fred')
      .write(null)
      .fails("Non-owner cannot delete room.")

      .as('mike')
      .write(null)
      .succeeds("Owner can delete room.")
    ;
  });

  test("Forge Creator of Room.", function(rules) {
    rules
      .as('mike')
      .at('/rooms/mikes-room')
      .write({
        name: "Mike's room",
        creator: uid('fred'),
      })
      .fails("Can't create forged room.");
  });

  test("Join a Room.", function(rules) {
    makeMikesRoom(rules)
      .at('/rooms/mikes-room/members/' + uid('mike'))
      .write({
        nickname: 'Mike',
        isBanned: false
      })
      .succeeds("Add self to room members.")

      .at('/rooms/mikes-room/members/' + uid('fred'))
      .write({
        nickname: 'Fred',
        isBanned: false
      })
      .succeeds("Creator can add other members.")

      .as('barney')
      .at('/rooms/mikes-room/members/' + uid('barney'))
      .write({
        nickname: 'Barney',
        isBanned: false
      })
      .succeeds("User can add self to a room.")

      .as('mike')
      .at('/rooms/mikes-room/members/' + uid('fred'))
      .write(null)
      .succeeds("Creator can remove a member.")
    ;
  });

  test("Banning and unbanning.", function(rules) {
    makeMikesRoom(rules)
      .at('/rooms/mikes-room/members/' + uid('mike'))

      .as('barney')
      .at('/rooms/mikes-room/members/' + uid('barney'))
      .write({
        nickname: 'Barney',
        isBanned: false
      })
      .succeeds("User can add self to a room.")

      .as('mike')
      .at('/rooms/mikes-room/members/' + uid('barney') + '/isBanned')
      .write(true)
      .succeeds("Creator can ban a member.")

      .as('barney')
      .at('/rooms/mikes-room/members/' + uid('barney'))
      .write(null)
      .fails("User tries to delete self.")

      .as('barney')
      .at('/rooms/mikes-room/members/' + uid('barney'))
      .write({
        nickname: 'Barney',
        isBanned: false
      })
      .fails("User tries to rejoin")

      .as('barney')
      .at('/rooms/mikes-room/members/' + uid('barney') + '/isBanned')
      .write(false)
      .fails("User tries to unban self.")

      .as('mike')
      .at('/rooms/mikes-room/members/' + uid('barney') + '/isBanned')
      .write(false)
      .succeeds("Room creator can unban user.")
    ;
  });

  test("Posting.", function(rules) {
    makeMikesRoom(rules)
      .at('/posts/mikes-room')
      .push({
        from: uid('mike'),
        message: "Hello, world!",
        created: test.TIMESTAMP,
      })
      .fails("Owner can't write into room until he is a member.")

      .at('/rooms/mikes-room/members/' + uid('mike'))
      .write({
        nickname: 'Mike',
        isBanned: false
      })
      .succeeds("Add self to room members.")

      .at('/posts/mikes-room')
      .push({
        from: uid('mike'),
        message: "Hello, world!",
        created: test.TIMESTAMP,
      })
      .succeeds("Owner-member can post to room.")

      .as('barney')
      .at('/posts/mikes-room')
      .push({
        from: uid('barney'),
        message: "Hello, Mike!",
        created: test.TIMESTAMP,
      })
      .fails("Non-members cannot post.")

      .as('barney')
      .at('/rooms/mikes-room/members/' + uid('barney'))
      .write({
        nickname: 'Barney',
        isBanned: false
      })
      .succeeds("User can add self to a room.")

      .as('barney')
      .at('/posts/mikes-room')
      .push({
        from: uid('barney'),
        message: "Hello, Mike!",
        created: test.TIMESTAMP,
      })
      .succeeds("Members can post.")

      .as('mike')
      .at('/rooms/mikes-room/members/' + uid('barney') + '/isBanned')
      .write(true)
      .succeeds("Creator can ban a member.")

      .as('barney')
      .at('/posts/mikes-room')
      .push({
        from: uid('barney'),
        message: "Hello, Mike!",
        created: test.TIMESTAMP,
      })
      .fails("Banned members cannot post.")
    ;
  });
});
