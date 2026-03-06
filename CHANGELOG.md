# Changelog

## 1.0.0 (2026-03-06)


### Features

* add @types/bun dependency to package.json and bun.lock ([2effa9b](https://github.com/sn0-y/strinova-navigator/commit/2effa9b0f36cd38db23041e3318656878c82d5af))
* add a footer to the message ([378da2e](https://github.com/sn0-y/strinova-navigator/commit/378da2ed364d2fa34d1052d1b7cd7223b5d21b54))
* add event management commands and integrate Redis for event tracking ([d37f868](https://github.com/sn0-y/strinova-navigator/commit/d37f868775b7eb580812c26c0c880760fc91400d))
* add nixpacks configuration for setup, install, build, and start phases ([998a5e1](https://github.com/sn0-y/strinova-navigator/commit/998a5e11045b0c142f22ebb83fd08c9afff85484))
* add postgresql database with prismaorm ([c534978](https://github.com/sn0-y/strinova-navigator/commit/c534978e52abd16b6f9185c077bc7a562ccb4e44))
* add reportSent function and integrate report check in ButtonHandler ([cec7438](https://github.com/sn0-y/strinova-navigator/commit/cec7438ed105d64aa5b5146a7b929e6b03b28d0b))
* add sapphire scheduled tasks plugin ([bd301f8](https://github.com/sn0-y/strinova-navigator/commit/bd301f806c6ce05ad65c6d3d6b4802cad6262ceb))
* add support for PrivateThread channel type in event tracking ([0b462a2](https://github.com/sn0-y/strinova-navigator/commit/0b462a29f89dfb2ea1c965dda104643fb8193093))
* automated release management ([26457e1](https://github.com/sn0-y/strinova-navigator/commit/26457e104dab0f14cf1b5ed341751dbbd44acb69))
* Backfill Support ([8a25559](https://github.com/sn0-y/strinova-navigator/commit/8a25559f22b0e26cb37dea5fe50fdfd16cc54e8d))
* Configuration for moderation rewards system ([bd1a38f](https://github.com/sn0-y/strinova-navigator/commit/bd1a38fe843233b787776bdc158a36712940cca6))
* enhance event management with new claim and report features, update dependencies, and refactor event handling ([47230cd](https://github.com/sn0-y/strinova-navigator/commit/47230cdc0f74bbc0db1a4ea5489d251f1baf31e5))
* enhance event tracking with rules support ([4036590](https://github.com/sn0-y/strinova-navigator/commit/4036590d634e50314e522e1c98db4a3414c39ea0))
* implement higher role preconditions ([f2552ee](https://github.com/sn0-y/strinova-navigator/commit/f2552ee99df36a5ec7da9ec0113d7bb3e42c798d))
* implement mod rewards log parser and service functions ([806e155](https://github.com/sn0-y/strinova-navigator/commit/806e15577598e1870ca410934ad401bbea9836b0))
* implement moderation reports system with weekly and monthly statistics ([6fa1b48](https://github.com/sn0-y/strinova-navigator/commit/6fa1b489c2843e369ea87e2fe41c995faf48d0d6))
* implement user submissions listener and enhance event service functions ([ca4b651](https://github.com/sn0-y/strinova-navigator/commit/ca4b651a01a91f65e66f4dcafb0077001fbf9f75))
* Statbot API Token field in env ([63e3bda](https://github.com/sn0-y/strinova-navigator/commit/63e3bda5eaa9de17867c09beb9081945cfd5a5c9))


### Bug Fixes

* add claimedAt timestamp when updating winner UID ([81e42d9](https://github.com/sn0-y/strinova-navigator/commit/81e42d902bb0a418a8ed5be57e60d8205d00a9c5))
* add error handling for scheduled task creation in event reporting ([a9f7019](https://github.com/sn0-y/strinova-navigator/commit/a9f7019317e9c8c1881f4f8b24f8fb1a7c95a695))
* add expiration time to Redis cache for active events ([4a73464](https://github.com/sn0-y/strinova-navigator/commit/4a734641493fb7fc64d9eeeac790fd4dec28e1fd))
* add missing index on channelId and status in Event model ([9a3532a](https://github.com/sn0-y/strinova-navigator/commit/9a3532a0767c400ffd9b8ea87ff75813656b5638))
* add missing index on eventId in Participant and Winner models ([076c779](https://github.com/sn0-y/strinova-navigator/commit/076c779a8667122a05d5f2ec678081c48af823da))
* correct logic for event report check in ButtonHandler ([6c04fc3](https://github.com/sn0-y/strinova-navigator/commit/6c04fc37c82071e156fead9feea754332b6545a7))
* correct winner mentions formatting in prize collection message ([2d21358](https://github.com/sn0-y/strinova-navigator/commit/2d21358607824046cf96bad7e2eca42708c5a900))
* enforce unique inGameUid per event in Winner model and improve error handling in UID submission ([e32b6a4](https://github.com/sn0-y/strinova-navigator/commit/e32b6a41f2c76846cb96d437e992ce2a8b449fab))
* enhance logging for Redis connection and error handling in user submissions ([7a903fc](https://github.com/sn0-y/strinova-navigator/commit/7a903fc013990d938e7af5a6c13fb834fce6bbec))
* enhance winner selection error handling and ensure event status update in endEvent function ([226e973](https://github.com/sn0-y/strinova-navigator/commit/226e973115f9ce7c43ed10766dcbaaac28a190de))
* improve event retrieval logic with in-flight request handling and caching ([1b7bc2d](https://github.com/sn0-y/strinova-navigator/commit/1b7bc2d015c1117e9c9b8212a8dc92b9d1b4fc23))
* improve UID submission validation and error handling ([ce2a39d](https://github.com/sn0-y/strinova-navigator/commit/ce2a39d52327c41de3d3da7f93a471bbd88aac7e))
* make channel option optional in event tracking command ([44a3e21](https://github.com/sn0-y/strinova-navigator/commit/44a3e211ef085bfe414fb701ec3eecf3e3004bef))
* refactor endEvent to endEventAndPickWinners for improved winner selection and error handling ([cab8c23](https://github.com/sn0-y/strinova-navigator/commit/cab8c23545146e7157b1c1dfa1c0a08333872a37))
* update environment variable path to use .env instead of .env.local ([0d57b6f](https://github.com/sn0-y/strinova-navigator/commit/0d57b6f5dc7c6367f88fd4ceff836cec03dca9d6))
* update event handling logic to ensure report status is checked asynchronously and improve winner selection process ([db973d2](https://github.com/sn0-y/strinova-navigator/commit/db973d243cb2acc8314faad7c487f6b252cc6ac3))
* update event retrieval methods to get active and latest events ([c34a804](https://github.com/sn0-y/strinova-navigator/commit/c34a8042ed62fa8a4c8bb7ddf2019c65b5753d64))
* update eventNotifications channel ID in config ([0a9d157](https://github.com/sn0-y/strinova-navigator/commit/0a9d15793ba2a250ba3b918c2e03eb154c27bdcf))
