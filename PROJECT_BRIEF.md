# Project Brief: Real-Time Group Tracking System (MERN)

Read this whole file before writing any code. It is the source of truth for scope, stack, data model and build order. If something here is unclear or conflicts, ask me before guessing.

## 1. What we are building

A web application for motorcycle riders and road vehicles (bikes and cars) travelling in a group. Members share live GPS locations during a ride and everyone sees all vehicles on one real-time map with name, vehicle type and last-seen time. The group is alerted when a member stops for too long or falls behind. Only the group leader (admin) can add or remove members. Finished rides are saved and can be viewed on a map. Members can send an SOS alert and quick messages to the group.

**Problem:** riders and drivers get separated on group trips and rely on phone calls and messages to find each other, which is distracting and unsafe. General map apps are not built to manage a whole group of vehicles.

**Context:** this is a BCA final-year project (Web Application track). I must be able to explain every part of the code in a viva, so simple, readable, well-commented code matters more than clever code. Do not add frameworks or abstractions beyond what is listed.

## 2. Users and permissions

| Role | Can do |
|---|---|
| Group leader (admin) | Create group, approve or reject join requests (add members), remove members, start and end rides, plus everything a member can do |
| Group member | Join a group with a code, share live location during an active ride, view the live map, receive alerts, send SOS and quick messages, view ride history |
| Passenger (optional) | View the live map and group status only, and can use chat. Does not share location |

Permission rules (enforce on the server, never only in the UI):

- Only the leader can approve, reject or remove members, and start or end a ride.
- A join code only creates a pending request. The leader approves it before the person sees the group or its locations.
- Members can leave a group at any time.

## 3. Tech stack (do not change without asking)

| Area | Choice |
|---|---|
| Frontend | React.js (built with Vite), plain CSS, JavaScript (ES modules), React Router for screens. Mobile-first responsive layout. In production the built frontend is served by Express, so only one app is hosted |
| Map | Leaflet.js through react-leaflet, with OpenStreetMap tiles (no Google Maps, no paid APIs) |
| Location | Browser Geolocation API (`watchPosition`) and the Screen Wake Lock API |
| Backend | Node.js, Express.js, Socket.IO |
| Database | MongoDB (Atlas free tier) using Mongoose. No raw SQL and no other ORM or ODM |
| Hosting target | Render or Railway (free tier) |
| Dev tools | Git/GitHub, VS Code, Postman, Vite |

**Secure context (important):** the Geolocation API and Screen Wake Lock only work on HTTPS pages, or on localhost. Testing on a real phone against a laptop's local address will fail. For phone testing during development, use an HTTPS tunnel (for example ngrok or Cloudflare Tunnel) or deploy early to Render or Railway, and explain the chosen setup in the README.

**Local setup:** before writing code, ask me which operating system I use. Then document step by step in the README how to:

1. Install Node.js.
2. Create a free MongoDB Atlas cluster, create a database user, allow network access, and copy the connection string.
3. Put the connection string in `.env` as `MONGODB_URI` (also document every other variable in `.env.example`).
4. Install dependencies and start the client and server.

## 4. Architecture

```
Member phone (browser + GPS) --Socket.IO--> Node/Express server --Socket.IO--> other members' browsers (Leaflet map)
                                                  |
                                              MongoDB
```

- Each group is a Socket.IO room. A member only receives events for groups they are approved in.
- Location updates are sent every 3 to 5 seconds (configurable constant, default 4 s).
- The server validates every update, stores it, and broadcasts it to the room.

### Frontend rules (React)

- Use function components and hooks only. No class components, and no Redux or other state libraries. Use `useState`, `useEffect` and `useContext` (for the logged-in user and the socket).
- Keep components small and commented. One component per file, with clear names.
- Put browser features in custom hooks: `useSocket`, `useGeolocation` (wraps `watchPosition`) and `useWakeLock`.
- Clean up every effect. Always disconnect the Socket.IO listeners, clear the geolocation watcher and release the wake lock when a component unmounts. React may run effects twice in development, so there must never be duplicate sockets, duplicate location watchers or double updates.
- Do not recreate Leaflet markers on every update. Keep markers keyed by user id and move them as new positions arrive.
- Keep styling separate from logic. Use plain CSS files (one per page or component), no inline styles. Put all colors, font sizes, spacing and border radius as CSS variables in one `client/src/theme.css` file so the visual design can be changed later without touching component logic.
- Use environment variables for the API and socket URLs (`VITE_API_URL`), with a Vite dev proxy to the Express server in development.
- In production, run `vite build` and let Express serve the `client/dist` folder.

## 5. Data model (MongoDB / Mongoose)

Define one Mongoose model per collection in `server/models/`. Use ObjectId references instead of uuids. Use timestamps (`createdAt`) where listed.

| Collection | Fields |
|---|---|
| `users` | displayName, vehicleType (`bike` \| `car` \| null for passengers), token (random, unique, indexed), createdAt |
| `groups` | name, code (unique, 6 characters, hard to guess), leaderId (ref users), createdAt |
| `groupmembers` | groupId, userId, role (`leader` \| `member` \| `passenger`), status (`pending` \| `approved` \| `removed`), joinedAt |
| `rides` | groupId, startedAt, endedAt, status (`active` \| `ended`) |
| `locationpoints` | rideId, userId, lat, lng, accuracy, speed, heading, recordedAt (client time), receivedAt (server time) |
| `alerts` | rideId, userId, type (`stopped` \| `behind` \| `sos`), details (plain object; for SOS include last known location and who acknowledged), status (`active` \| `resolved`), createdAt |
| `messages` | rideId, userId, kind (`quick` \| `text`), body, createdAt |

Indexes and design rules:

- Keep `locationpoints` as its own collection. Never embed points inside the ride document.
- Index `locationpoints` on `{ rideId: 1, recordedAt: 1 }`.
- Unique index on `groups.code`.
- Unique index on `{ groupId: 1, userId: 1 }` in `groupmembers`.
- Index `users.token`.
- Keep the database connection in `server/db.js` and read `MONGODB_URI` from `.env`.

**Identity (keep it simple):** no passwords for the MVP. When a user enters a display name and vehicle type, create a user document and give the browser a random token stored in localStorage. Send it with API calls and the socket handshake. Resolve the user from the token on the server. The "Passenger" option on the join screen sets the member's role to passenger and does not need a vehicle type, so `vehicleType` may be null for passengers.

## 6. API and socket events

### REST

- `POST /api/users` create profile, returns token
- `POST /api/groups` create group (caller becomes leader), returns code
- `POST /api/groups/join` body `{code}`, creates a pending request
- `GET /api/groups/:id` group details and approved members
- `POST /api/groups/:id/members/:userId/approve` (leader only)
- `DELETE /api/groups/:id/members/:userId` reject or remove (leader only)
- `POST /api/groups/:id/rides/start` and `POST /api/rides/:id/end` (leader only)
- `GET /api/groups/:id/rides` ride list
- `GET /api/rides/:id/points` saved route points
- `GET /api/rides/:id/messages` chat history
- `GET /api/rides/:id/export.csv` ride points with timestamps (see section 8)

Rate-limit join attempts per user and per IP so a 6-character code cannot be brute-forced.

### Socket.IO

- **client to server:** `location:update {lat, lng, accuracy, speed, heading, sentAt}`, `sos:trigger`, `sos:ack`, `sos:resolve`, `message:send {kind, body}`
- **server to clients:** `location:update` (with user id, name, vehicle type), `ride:started`, `ride:ended`, `member:request`, `member:approved`, `member:removed`, `alert:new`, `member:stale`, `sos:new`, `sos:resolved`, `message:new`

Rate-limit location events per user and ignore updates from users who are not approved members of an active ride.

## 7. Features and behavior

- **Profile and groups:** enter name and vehicle type, create a group or join with a code.
- **Live map:** markers per member (different icon for bike and car), name label, and last-seen time. Mark a member as stale after 30 seconds without an update and show "last seen X ago".
- **Ride sessions:** location is shared only between the leader pressing start and end. Show a clear consent screen before a member starts sharing, and a visible "sharing location" indicator.
- **Alerts (computed on the server):**
  - Stopped: speed below about 1.5 m/s for longer than a threshold (default 3 minutes).
  - Fell behind: distance from the group's center or from the leader above a threshold (default 500 m) for longer than 60 seconds.
  - Thresholds are constants in `server/config.js`. Do not alert the same member repeatedly while the condition holds.
- **Ride history:** save every ride and show each member's route as a line on a map, with distance, duration and stops. Replay is NOT part of this version (see section 13).
- **Wake lock:** request a screen wake lock during an active ride so the browser keeps sending location. Note the limitation in the README.
- **Optional, only if time remains:** buffer location points on the phone during signal loss and upload them in a batch when the connection returns.
- **SOS (build in M3):** a clearly separate red SOS button on the live map. Requires press-and-hold for 3 seconds to avoid accidents. It creates an `sos` alert and sends the sender's name and last known location to every approved member in real time, shown as a full-screen alert. Other members can tap "I'm coming" (acknowledge), the sender or leader can mark it resolved, and the sender can cancel a false alarm. It works only during an active ride. It alerts the group only. The UI must say it does not call emergency services.
- **Quick messages and chat (quick messages in M4, free-text chat only as a stretch):** a set of one-tap preset messages ("Need a break", "Fuel stop", "Slow down", "Wait for me", "All OK", "Turn back?") shown as chat bubbles to the group. Free-text typing is disabled for riders and drivers while the vehicle is moving (speed above about 5 m/s); passengers can type at any time. Rate-limit messages per user.

## 8. Evaluation support (needed for my report)

I must measure update delay, location accuracy and battery use from real test rides. So:

- Include `sentAt` (client) and `receivedAt` (server) on every point so delay can be computed.
- Add `GET /api/rides/:id/export.csv` that exports a ride's points with those timestamps.
- Make the update interval a single constant so I can test 2 s, 5 s and 10 s.

## 9. Safety, privacy and security

- The interface must be glanceable: large text and buttons, no typing needed during a ride.
- Share location only during an active ride and only with approved group members. Provide a way to leave a group and delete my stored data.
- Validate and sanitize all input. Check types with a schema check and reject objects where strings are expected (this prevents NoSQL injection such as `{ "$ne": null }` in a body field). Use `helmet`, and keep secrets in `.env` (provide `.env.example`, never commit real secrets).
- Group codes must not be sequential or guessable (use a random generator, not a counter).
- Never imply SOS contacts emergency services. Say "alerts your group" everywhere it appears.
- Do not let riders or drivers type while moving. Offer one-tap quick messages instead.

## 10. Folder structure

```
/
  server/
    index.js          Express and Socket.IO setup
    config.js         constants (intervals, thresholds)
    db.js             MongoDB (Mongoose) connection
    models/           User, Group, GroupMember, Ride, LocationPoint, Alert, Message
    routes/           users, groups, rides
    sockets/          location and room handling
    services/         alert logic, permission checks
  client/             React app (Vite)
    src/
      components/     Map, MemberList, AlertBanner, ConsentScreen, SosButton, QuickMessages
      pages/          Profile, Lobby, LiveRide, Chat, History
      hooks/          useSocket, useGeolocation, useWakeLock
      api.js          REST helpers
      theme.css       CSS variables (colors, fonts, spacing)
      main.jsx
    index.html
  design/             wireframes (images)
  tests/
  .env.example
  .gitignore          must include node_modules/, .env, dist/
  README.md
```

## 11. Build order (work one milestone at a time)

| Milestone | Done when |
|---|---|
| **M1 Prototype** | React app and Express server set up, MongoDB connected, two phones open the app, share location, and see each other move on one map |
| **M2 Groups and roles** | Name and vehicle profile, create and join with code, leader approval and removal, ride start and end, live map for the whole group, permissions enforced on the server |
| **M3 Alerts, history and SOS** | Stopped and behind alerts work, rides are saved, route view works, SOS works end to end (send with hold, received on all phones, acknowledge, resolve, cancel) |
| **M4 Messages, testing and deployment** | One-tap quick messages work, bugs fixed, permission tests pass, CSV export works, deployed on Render or Railway |
| **Stretch** (only after M4 is fully done) | Free-text chat for passengers, offline buffering, anything in section 13 |

Build in this order and do not start a later milestone's feature before the current milestone is done and tested. SOS comes after alerts because it reuses the same real-time alert mechanism.

## 12. How I want you to work

- Build one milestone at a time. After each, stop, summarize what you built and how to run it, and wait for my go-ahead.
- Start by showing a short plan and the file list for the milestone before writing code.
- Keep code simple and commented. Explain any non-obvious part in a short note so I can understand it.
- Write tests for the permission logic (leader-only actions) and the alert rules.
- Keep `README.md` current: setup steps, environment variables, how to run, features built so far, and known limitations.
- Use small, clear Git commits.
- Do not add paid services, new frameworks or features outside this brief. If you think something is needed, ask first.
- First question to ask me before anything else: which operating system I use.

## 13. Out of scope

Native mobile apps, turn-by-turn navigation, payments, social features, AI or ML features, contacting emergency services, and ride replay. Replay is a possible future upgrade: playing a saved ride back at 10x to 60x speed with a timeline slider.

## 14. Definition of done

A deployed web app where an approved group shares live locations on one map, the leader controls membership, alerts fire correctly, finished rides can be viewed, SOS and one-tap messages work, with a README and test data that let me run test rides and export results for my report.

## 15. UI reference (wireframes)

Wireframes are in the `design/` folder (exported from the design canvas). They are a layout and flow reference, not pixel-perfect. Match the structure, keep buttons large and text big, and use simple CSS.

- **Join a group:** name, vehicle type (Bike, Car, Passenger), group code, "Request to join", "Create a new group".
- **Group lobby (leader view):** group code with copy button, join requests with Approve and Reject, member list with Remove, Start ride. Only the leader sees these controls.
- **Live map:** markers with name labels, "Sharing location" indicator, alert banner, floating SOS and chat buttons, bottom panel with each member's last-seen time and an End ride button for the leader.
- **Chat and quick messages:** message bubbles, SOS notices in the thread, a grid of quick messages, and a disabled text box while moving.
- **Send SOS:** hold-to-send button, note that it alerts the group only, and Cancel.
- **SOS received:** red banner, mini map with last known location, "I'm coming", "Show on map", list of responders.
- **Ride history:** route on a map with distance, duration and stops, and a list of earlier rides. No replay in this version.

Build the screens in the same order as the milestones in section 11.
