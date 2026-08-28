# Changelog

## [1.7.0](https://github.com/Geodock-GmbH/Qonnectra/compare/v1.6.0...v1.7.0) (2026-08-28)


### Features

* Sidebar customization and user setting sync ([#83](https://github.com/Geodock-GmbH/Qonnectra/issues/83)) ([3d3d142](https://github.com/Geodock-GmbH/Qonnectra/commit/3d3d1421dea96faa65a3cc7e246c43fa7ffe5195))


### Miscellaneous

* Fixed github workflow error that it cant find paraglide messages ([3f8951b](https://github.com/Geodock-GmbH/Qonnectra/commit/3f8951bc523eb3fab931739113cdcddf8504f86c))
* Fixed test where the timezone was missing which let the github workflow fail ([841841c](https://github.com/Geodock-GmbH/Qonnectra/commit/841841cd7dcdf579e5a4d70e7a7f7c4391373b19))
* Migrated component to ts ([#84](https://github.com/Geodock-GmbH/Qonnectra/issues/84)) ([7c3c244](https://github.com/Geodock-GmbH/Qonnectra/commit/7c3c244df10dcd470f7c4bfd740dcab4eca589bd))
* Migration skeleton v4 to v5 ([#81](https://github.com/Geodock-GmbH/Qonnectra/issues/81)) ([2066149](https://github.com/Geodock-GmbH/Qonnectra/commit/206614903b1ff35d18709b3c6c9001a1c2bfe0fe))
* Updated action from v4 to v5 ([65cb4aa](https://github.com/Geodock-GmbH/Qonnectra/commit/65cb4aa557a4f347a56ba71442e62f7d7aad55ce))

## [1.6.0](https://github.com/Geodock-GmbH/Qonnectra/compare/v1.5.1...v1.6.0) (2026-08-24)


### Features

* Add exclude_projects filter to spatial intersect and Geo all/ endpoints ([#80](https://github.com/Geodock-GmbH/Qonnectra/issues/80)) ([57d46ca](https://github.com/Geodock-GmbH/Qonnectra/commit/57d46ca934ec8f49339cb79bf0094574eb3178d0))
* Add project filter to trench list endpoint ([c9dd93d](https://github.com/Geodock-GmbH/Qonnectra/commit/c9dd93d88a0dc7c2d47576c99273757db3a859d2))
* Added drf namespaceversioning ([03ff8d0](https://github.com/Geodock-GmbH/Qonnectra/commit/03ff8d016e20c6d3a1bf31605b2f9c798946c95d))
* Added spatial intersection endpoints ([4b53eae](https://github.com/Geodock-GmbH/Qonnectra/commit/4b53eae2b8a22f5b1c46bf13275e95a94471264f))
* Migrate frontend to TS plus test coverage ([#79](https://github.com/Geodock-GmbH/Qonnectra/issues/79)) ([8b0db74](https://github.com/Geodock-GmbH/Qonnectra/commit/8b0db740fd593f092da4a2e78c4fa8a1e9a2c775))


### Bug Fixes

* Minor changes ([7ba67fb](https://github.com/Geodock-GmbH/Qonnectra/commit/7ba67fb84bf3a65052e7fdf0c9ce148cf4a34eae))
* Set cache control to public, so error responses get no-store ([7ebddc7](https://github.com/Geodock-GmbH/Qonnectra/commit/7ebddc7581e5424db8a1931b61ad000b764cde9a))


### Miscellaneous

* Added an extra import for overwrite files ([5ea197c](https://github.com/Geodock-GmbH/Qonnectra/commit/5ea197cc542c07e71a70e10c0f7a96c92fd2a24f))
* Delete bump-version script ([1292df9](https://github.com/Geodock-GmbH/Qonnectra/commit/1292df9db1164b5c8400098c2fd23c789bf93fa3))
* Removed workspace file ([58ad23d](https://github.com/Geodock-GmbH/Qonnectra/commit/58ad23def832087844271680466f28d47ee897ee))

## [1.5.1](https://github.com/Geodock-GmbH/Qonnectra/compare/v1.5.0...v1.5.1) (2026-07-15)


### Bug Fixes

* Added missing project id to the pipeline zip export so it respects the project boundary ([0cb21ef](https://github.com/Geodock-GmbH/Qonnectra/commit/0cb21ef4223fb68bfd19063e090fa4c791ad7879))
* Added validations to the qgis project which run on every upload ([cbc0fef](https://github.com/Geodock-GmbH/Qonnectra/commit/cbc0fef1a5fd44e354b58aac84c6df9dd1ae1595))
* QGIS server container was always unhealty because curl does not exists. Replaced it with wget ([aa22d8d](https://github.com/Geodock-GmbH/Qonnectra/commit/aa22d8d433a455e4dcdcdb4d20f1ae6cf2e0b81c))


### Refactoring

* Added the slot side to the fiber label ([95c5a84](https://github.com/Geodock-GmbH/Qonnectra/commit/95c5a84cbb056c4de690fb733858def854f80042))
* WMS token heartbeat at request time ([d54dcd3](https://github.com/Geodock-GmbH/Qonnectra/commit/d54dcd38c6849a4bba7520b7cc513c35ae5cd92b))

## [1.5.0](https://github.com/Geodock-GmbH/Qonnectra/compare/v1.4.0...v1.5.0) (2026-07-10)


### Features

* Added TPU info to the fiber in the fiber side bar ([caca213](https://github.com/Geodock-GmbH/Qonnectra/commit/caca21303bc2e56ccced8a9bdd1d787d7decdd42))
* Auto micropipe-cable linking when a cable connects to a node with an uuid_address ([0bb65d8](https://github.com/Geodock-GmbH/Qonnectra/commit/0bb65d82c3d1cd42b686aba3bf66e532d400d637))


### Bug Fixes

* Fixed bugs in clear port flow ([ed92e92](https://github.com/Geodock-GmbH/Qonnectra/commit/ed92e929cde08a3e0fe67a0f970fa6f819c46b0e))
* Fixed typo in Wertermittlung ([816ff35](https://github.com/Geodock-GmbH/Qonnectra/commit/816ff3594df3bc515993d8e7ea0464d1e8c24265))


### Refactoring

* Cable and componentsidebar can now we drag bigger and smaller. ([c081fcf](https://github.com/Geodock-GmbH/Qonnectra/commit/c081fcf3efe6d73278f867a050b4e570cb254d4f))

## [1.4.0](https://github.com/Geodock-GmbH/Qonnectra/compare/v1.3.0...v1.4.0) (2026-07-07)


### Features

* Added address compact map to post-compation export ([4e7368f](https://github.com/Geodock-GmbH/Qonnectra/commit/4e7368ff6a2ee747b3accdc37380a165aba28c2d))
* Jwt bearer auth for external apps ([03070f0](https://github.com/Geodock-GmbH/Qonnectra/commit/03070f09ada928a64408511e400afe078726e401))
* Pipeline Records with inquiry area drawing ([#74](https://github.com/Geodock-GmbH/Qonnectra/issues/74)) ([91396b2](https://github.com/Geodock-GmbH/Qonnectra/commit/91396b2b38d98655a792093992747045557903f8))
* Valuation based on set project rates ([#75](https://github.com/Geodock-GmbH/Qonnectra/issues/75)) ([e517633](https://github.com/Geodock-GmbH/Qonnectra/commit/e51763381d0bbb2be15357f54dcf5efdd7eb420d))


### Bug Fixes

* Fixed typo on POP key for default colors ([171a350](https://github.com/Geodock-GmbH/Qonnectra/commit/171a35081b9603cf1c2a0fd4ec842f7999575e51))
* XSS on file preview, SSRF in wms refresh and CSRF hardening ([#73](https://github.com/Geodock-GmbH/Qonnectra/issues/73)) ([ad5d764](https://github.com/Geodock-GmbH/Qonnectra/commit/ad5d7647cec114f6c4aa5744a9c18c5574268223))


### Refactoring

* Moved openlayer styles initilized in different files into styles.js ([432ec73](https://github.com/Geodock-GmbH/Qonnectra/commit/432ec73dceb87fbefa628aa8ea152ac6ab1d440f))
* Replaced ILIKE search with pg_trgm for address, node and area ([#70](https://github.com/Geodock-GmbH/Qonnectra/issues/70)) ([f6a1002](https://github.com/Geodock-GmbH/Qonnectra/commit/f6a1002dc3ad64d5b4703fa870d0158a7c352f37))

## [1.3.0](https://github.com/Geodock-GmbH/Qonnectra/compare/v1.2.0...v1.3.0) (2026-06-30)


### Features

* Added context menu for map component ([#68](https://github.com/Geodock-GmbH/Qonnectra/issues/68)) ([12b3820](https://github.com/Geodock-GmbH/Qonnectra/commit/12b382030236d7b6dea87711aa80a2aa7263ae35))
* Added second optional address id to address model and detailed page ([f0fa476](https://github.com/Geodock-GmbH/Qonnectra/commit/f0fa47694aa663892869b603c4b48b86db539bc3))
* Post-compaction address workflow with PDF export ([#69](https://github.com/Geodock-GmbH/Qonnectra/issues/69)) ([36db53d](https://github.com/Geodock-GmbH/Qonnectra/commit/36db53d4908a60fa7479d80cdf9d9d600cb18828))


### Refactoring

* Address map now uses trace address instead of newly added endpoint ([657652c](https://github.com/Geodock-GmbH/Qonnectra/commit/657652c65fb7efad840a78e87e9c7e667c26e75b))

## [1.2.0](https://github.com/Geodock-GmbH/Qonnectra/compare/v1.1.1...v1.2.0) (2026-06-29)


### Features

* Add CSV export for fault simulation results ([#65](https://github.com/Geodock-GmbH/Qonnectra/issues/65)) ([891957c](https://github.com/Geodock-GmbH/Qonnectra/commit/891957cedd5f779b1463db41e1ac1cffd26a609d))
* Added trench features to compact address map ([#66](https://github.com/Geodock-GmbH/Qonnectra/issues/66)) ([b15d31c](https://github.com/Geodock-GmbH/Qonnectra/commit/b15d31c825e700039b8d072650e485e9374dace5))


### Miscellaneous

* Added more map hints for map centered routes ([a90aeb8](https://github.com/Geodock-GmbH/Qonnectra/commit/a90aeb86b13a3bed007a8f96057682dc1ed59525))
* Fixed prs_created for release-please ([8c5cf4d](https://github.com/Geodock-GmbH/Qonnectra/commit/8c5cf4da69eaca1b6a7e034be986dcb12ae06e02))
* Fixed some pylance warnings, ruff format and prettier format ([6349d7d](https://github.com/Geodock-GmbH/Qonnectra/commit/6349d7d72cce20461c35e79a1eb30089d7eea46e))
* Fixed the publiccode yml file format that the github bot changed ([5b36a3c](https://github.com/Geodock-GmbH/Qonnectra/commit/5b36a3cfed0a9c2aa76e175390856daa86d7414f))
* Renamed EN screenshot ([ee4963a](https://github.com/Geodock-GmbH/Qonnectra/commit/ee4963acff194b46a52b2eb8a983161dedb70a44))
* Renamed EN screenshot ([1dac5cd](https://github.com/Geodock-GmbH/Qonnectra/commit/1dac5cd2f0ce3db3df60fb091926ec3f9276db22))

## [1.1.1](https://github.com/Geodock-GmbH/Qonnectra/compare/v1.1.0...v1.1.1) (2026-06-16)


### Bug Fixes

* Gave address marker a layer-id so it wont get classed as base layer. Now it renders even when the backgroundmap is off ([f551a5a](https://github.com/Geodock-GmbH/Qonnectra/commit/f551a5a77d30d08d1e3c8af4242e91869bcf5050))


### Refactoring

* Moved dashboard load function to a seperate file ([f738075](https://github.com/Geodock-GmbH/Qonnectra/commit/f7380750ad5355f35e47163cd4854be14218e605))


### Miscellaneous

* Added first EN screenshots for opencode ([8974ff7](https://github.com/Geodock-GmbH/Qonnectra/commit/8974ff7072214917e1c08d5f5305e3042e7d475d))
* Added more EN screenshots ([a414da2](https://github.com/Geodock-GmbH/Qonnectra/commit/a414da2bff8138ba24d22f70446d40d93ad9922d))
* Added release please to the project ([eab7b74](https://github.com/Geodock-GmbH/Qonnectra/commit/eab7b74fe498f7b5f047f2e93c66b0c058da53b1))
* Added SECURITY file to the project ([e2e6589](https://github.com/Geodock-GmbH/Qonnectra/commit/e2e6589382865470da10c19550d7b17bafca58e0))
* Fixed release-please error with plain text ([af788c1](https://github.com/Geodock-GmbH/Qonnectra/commit/af788c1d0f11b722f0aefb4e24ea5967f4661b57))
* Second fix for release-please ([c4505ea](https://github.com/Geodock-GmbH/Qonnectra/commit/c4505eaa08786e4d919d41a32f90951669f5933e))
* Tailwind class change ([6f7f787](https://github.com/Geodock-GmbH/Qonnectra/commit/6f7f7871d0b459cb0557d62363f8c0964fa7404a))
* Third fix for release-please ([c1bc9b7](https://github.com/Geodock-GmbH/Qonnectra/commit/c1bc9b78b3f0e3cec7ae0e3feb1ff1ea42aacb17))
* Update publiccode file ([38782b0](https://github.com/Geodock-GmbH/Qonnectra/commit/38782b090b94230ce9cf28c91f9c6973af4df308))
