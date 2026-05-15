# Sheet Music Sequence Fingerprint

- fixtures: 20 sequence WAVs
- strategies: fast-note-matcher, essentia-pitch-yin

## Strategy Summary
| strategy | evaluated | passed | failed | notes | onsets | fixture pass rate | note recall | onset precision | onset recall | onset f1 | tagged hits | tagged p95 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fast-note-matcher | 20 | 16 | 4 | 293/320 | 219/320 | 80.0% | 91.6% | 19.6% | 13.4% | 16.0% | 43/320 | 50ms |
| essentia-pitch-yin | 20 | 16 | 4 | 289/320 | 219/320 | 80.0% | 90.3% | 19.6% | 13.4% | 16.0% | 43/320 | 50ms |

## Onset Strategy Summary
| onset strategy | fixtures | exact | under | over | detected/expected | onset ratio | tagged hits | tagged p95 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| guitar-onset-sweep-standard | 20 | 0 | 0 | 0 | 219/320 | 68.4% | 43/320 | 50ms |
| guitar-onset | 20 | 0 | 0 | 0 | 218/320 | 68.1% | 50/320 | 50ms |
| guitar-onset-broadband-or | 20 | 0 | 0 | 0 | 425/320 | 132.8% | 75/320 | 50ms |
| guitar-onset-legacy-bandpass | 20 | 0 | 0 | 0 | 210/320 | 65.6% | 49/320 | 50ms |

## Onset Strategy Detail: guitar-onset-sweep-standard

### Onset Count per Fixture
_Status: **exact** = Anzahl stimmt genau, **under** = zu wenig erkannt, **over** = zu viele erkannt, **mixed** = laut Tagged-Analyse beides (gleichzeitig fehlende und überschüssige Onsets)_

| fixture | expected notes | detected onsets | delta | status | onset times |
|---|---:|---:|---:|---|---|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | 11 | -5 | mixed | 3198ms 4346ms 4920ms 5494ms 7175ms 8405ms 9020ms 9553ms 10168ms 11316ms 11931ms |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | 11 | -5 | mixed | 3239ms 3403ms 3772ms 5248ms 6765ms 7790ms 8323ms 8856ms 9348ms 10332ms 10824ms |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | 8 | -8 | mixed | 1722ms 2214ms 2706ms 3649ms 4551ms 6396ms 6847ms 7831ms |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 16 | 18 | +2 | mixed | 1476ms 2952ms 4428ms 5945ms 7339ms 8938ms 9388ms 10618ms 12135ms 13734ms 15702ms 17219ms 18695ms 18859ms 20171ms 21606ms ... |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | 13 | -3 | mixed | 3116ms 4100ms 5166ms 7175ms 9307ms 10250ms 11275ms 12300ms 13284ms 14268ms 15293ms 16400ms 17425ms |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 16 | 17 | +1 | mixed | 3936ms 4879ms 6027ms 6970ms 7995ms 9020ms 10004ms 11070ms 12054ms 13079ms 14063ms 15129ms 16154ms 17220ms 18122ms 18286ms ... |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | 14 | -2 | mixed | 1968ms 3936ms 4551ms 5166ms 5740ms 6396ms 7093ms 7790ms 8446ms 9102ms 9799ms 10414ms 11070ms 11726ms |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | 14 | -2 | mixed | 3485ms 4059ms 5248ms 5904ms 6519ms 7134ms 7831ms 8528ms 9225ms 9922ms 11275ms 11931ms 12628ms 13325ms |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | 8 | -8 | mixed | 2952ms 3526ms 4838ms 7298ms 8651ms 9307ms 10660ms 11972ms |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | 7 | -9 | mixed | 2009ms 2624ms 4879ms 8077ms 9635ms 10988ms 11644ms |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 16 | 16 | 0 | mixed | 3239ms 3813ms 4428ms 5043ms 5658ms 6273ms 6970ms 7626ms 8364ms 9061ms 9717ms 10332ms 11070ms 11726ms 12382ms 13079ms |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 16 | 20 | +4 | mixed | 1230ms 2214ms 3239ms 4223ms 5248ms 6273ms 7175ms 7339ms 8200ms 9224ms 9798ms 10126ms 10290ms 10700ms 11110ms 12012ms ... |
| sheet-music-reading/fast.wav | 16 | 12 | -4 | mixed | 574ms 861ms 1107ms 1640ms 1886ms 2419ms 2952ms 3362ms 3731ms 3977ms 4510ms 4838ms |
| sheet-music-reading/medium.wav | 16 | 17 | +1 | mixed | 533ms 1271ms 2050ms 2788ms 3567ms 4387ms 5248ms 5945ms 6109ms 6683ms 7380ms 8118ms 8815ms 9552ms 10331ms 10987ms ... |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | 4 | -12 | mixed | 328ms 1394ms 1804ms 2132ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | 2 | -14 | mixed | 1435ms 1845ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | 9 | -7 | mixed | 1681ms 2050ms 2419ms 2788ms 3157ms 3854ms 5330ms 5699ms 6765ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | 7 | -9 | mixed | 943ms 2050ms 2788ms 3485ms 3895ms 4592ms 5699ms |
| sheet-music-reading/notenlesen1.wav | 16 | 8 | -8 | mixed | 2911ms 5166ms 5699ms 7544ms 9799ms 10373ms 10947ms 11521ms |
| sheet-music-reading/notenlesen2.wav | 16 | 3 | -13 | mixed | 3157ms 4305ms 7667ms |

_Gesamt: 219/320 Onsets erkannt (68.4%). exact: 0 · under: 0 · over: 0 · mixed: 20_

### Tagged Onset Accuracy per Fixture
_Vergleich der erkannten Onsets mit manuell getaggten Referenzzeitpunkten (Toleranzfenster: 50 ms)._
_**good** = Treffer < 20 ms Abweichung, **acceptable** = Treffer < 50 ms, **misses** = Onset verpasst, **false positives** = Fehlalarm ohne Referenz in der Nähe, **bias** = mittlere Richtungsabweichung (negativ = zu früh gefeuert)_

| fixture | tags | hits | good | acceptable | misses | false positives | duplicates | mean abs | p95 abs | bias |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | 1 | 0 | 1 | 15 | 10 | 0 | 50ms | 50ms | -50ms |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | 1 | 0 | 1 | 15 | 10 | 0 | 42ms | 42ms | +42ms |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | 3 | 0 | 3 | 13 | 5 | 0 | 37ms | 40ms | -37ms |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 16 | 0 | 0 | 0 | 16 | 18 | 0 | - | - | - |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | 3 | 0 | 3 | 13 | 10 | 0 | 45ms | 50ms | -45ms |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 16 | 1 | 0 | 1 | 15 | 16 | 0 | 49ms | 49ms | -49ms |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | 9 | 0 | 9 | 7 | 5 | 0 | 41ms | 50ms | -41ms |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | 5 | 1 | 4 | 11 | 9 | 0 | 40ms | 50ms | -40ms |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | 2 | 0 | 2 | 14 | 6 | 0 | 42ms | 42ms | -41ms |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | 1 | 0 | 1 | 15 | 6 | 0 | 43ms | 43ms | -43ms |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 16 | 4 | 0 | 4 | 12 | 12 | 0 | 47ms | 48ms | -47ms |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 16 | 0 | 0 | 0 | 16 | 20 | 0 | - | - | - |
| sheet-music-reading/fast.wav | 16 | 2 | 0 | 2 | 14 | 10 | 0 | 45ms | 47ms | -44ms |
| sheet-music-reading/medium.wav | 16 | 0 | 0 | 0 | 16 | 17 | 0 | - | - | - |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | 1 | 0 | 1 | 15 | 3 | 0 | 36ms | 36ms | -36ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | 0 | 0 | 0 | 16 | 2 | 0 | - | - | - |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | 2 | 0 | 2 | 14 | 7 | 0 | 42ms | 44ms | -41ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | 3 | 0 | 3 | 13 | 4 | 0 | 45ms | 49ms | -45ms |
| sheet-music-reading/notenlesen1.wav | 16 | 3 | 0 | 3 | 13 | 5 | 0 | 42ms | 50ms | -42ms |
| sheet-music-reading/notenlesen2.wav | 16 | 2 | 0 | 2 | 14 | 1 | 0 | 45ms | 46ms | -45ms |

_Gesamttreffer: 43/320 (13.4%). good: 1 · acceptable: 42 · misses: 277 · false positives: 176_

## Onset Strategy Detail: guitar-onset

### Onset Count per Fixture
_Status: **exact** = Anzahl stimmt genau, **under** = zu wenig erkannt, **over** = zu viele erkannt, **mixed** = laut Tagged-Analyse beides (gleichzeitig fehlende und überschüssige Onsets)_

| fixture | expected notes | detected onsets | delta | status | onset times |
|---|---:|---:|---:|---|---|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | 10 | -6 | mixed | 3198ms 4346ms 4920ms 5494ms 7175ms 8405ms 9020ms 9553ms 10168ms 11931ms |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | 11 | -5 | mixed | 3239ms 3362ms 3772ms 5248ms 6765ms 7790ms 8323ms 8856ms 9348ms 10332ms 10824ms |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | 8 | -8 | mixed | 1763ms 2214ms 2706ms 3649ms 4551ms 6396ms 6847ms 7831ms |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 16 | 20 | +4 | mixed | 1476ms 2952ms 3075ms 4428ms 5945ms 7339ms 8938ms 9388ms 10618ms 12135ms 13734ms 15702ms 17219ms 18695ms 18818ms 20171ms ... |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | 13 | -3 | mixed | 3116ms 4100ms 5166ms 7175ms 9307ms 10250ms 11275ms 12300ms 13284ms 14268ms 15293ms 16400ms 17425ms |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 16 | 17 | +1 | mixed | 3936ms 4879ms 6027ms 6970ms 7995ms 9020ms 10004ms 11070ms 12054ms 13079ms 14063ms 15129ms 16154ms 17220ms 18122ms 18245ms ... |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | 14 | -2 | mixed | 1968ms 2624ms 3936ms 4551ms 5166ms 5740ms 6396ms 7093ms 7790ms 8446ms 9102ms 9799ms 11070ms 11726ms |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | 14 | -2 | mixed | 3485ms 4059ms 5248ms 5904ms 6519ms 7134ms 7831ms 8528ms 9225ms 9922ms 11275ms 11931ms 12628ms 13325ms |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | 7 | -9 | mixed | 2952ms 3526ms 4838ms 7298ms 8651ms 9307ms 10660ms |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | 6 | -10 | mixed | 2009ms 2624ms 4879ms 9635ms 10988ms 11644ms |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 16 | 17 | +1 | mixed | 3239ms 3813ms 3936ms 4428ms 5043ms 5658ms 6273ms 6970ms 7626ms 8364ms 9061ms 9717ms 10332ms 11070ms 11726ms 12382ms ... |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 16 | 20 | +4 | mixed | 1230ms 2214ms 3239ms 4223ms 5248ms 6273ms 7175ms 7298ms 8200ms 9224ms 9798ms 10126ms 10249ms 10700ms 11110ms 12012ms ... |
| sheet-music-reading/fast.wav | 16 | 12 | -4 | mixed | 574ms 861ms 1107ms 1640ms 1886ms 2419ms 2952ms 3362ms 3731ms 3977ms 4510ms 4838ms |
| sheet-music-reading/medium.wav | 16 | 19 | +3 | mixed | 533ms 1271ms 1394ms 2050ms 2788ms 3567ms 4387ms 5248ms 5945ms 6068ms 6683ms 7380ms 7503ms 8118ms 8815ms 9552ms ... |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | 4 | -12 | mixed | 369ms 1394ms 1804ms 2132ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | 2 | -14 | mixed | 1435ms 1845ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | 7 | -9 | mixed | 1681ms 2050ms 2419ms 2788ms 3157ms 3854ms 5330ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | 6 | -10 | mixed | 943ms 2050ms 2788ms 3485ms 3895ms 5699ms |
| sheet-music-reading/notenlesen1.wav | 16 | 8 | -8 | mixed | 2911ms 5166ms 5699ms 7544ms 9799ms 10373ms 10947ms 11521ms |
| sheet-music-reading/notenlesen2.wav | 16 | 3 | -13 | mixed | 3157ms 4305ms 7667ms |

_Gesamt: 218/320 Onsets erkannt (68.1%). exact: 0 · under: 0 · over: 0 · mixed: 20_

### Tagged Onset Accuracy per Fixture
_Vergleich der erkannten Onsets mit manuell getaggten Referenzzeitpunkten (Toleranzfenster: 50 ms)._
_**good** = Treffer < 20 ms Abweichung, **acceptable** = Treffer < 50 ms, **misses** = Onset verpasst, **false positives** = Fehlalarm ohne Referenz in der Nähe, **bias** = mittlere Richtungsabweichung (negativ = zu früh gefeuert)_

| fixture | tags | hits | good | acceptable | misses | false positives | duplicates | mean abs | p95 abs | bias |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | 1 | 0 | 1 | 15 | 9 | 0 | 50ms | 50ms | -50ms |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | 1 | 1 | 0 | 15 | 10 | 0 | 1ms | 1ms | +1ms |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | 4 | 0 | 4 | 12 | 4 | 0 | 37ms | 40ms | -37ms |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 16 | 3 | 2 | 1 | 13 | 17 | 0 | 25ms | 36ms | +25ms |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | 3 | 0 | 3 | 13 | 10 | 0 | 45ms | 50ms | -45ms |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 16 | 2 | 1 | 1 | 14 | 15 | 0 | 38ms | 49ms | -11ms |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | 8 | 0 | 8 | 8 | 6 | 0 | 41ms | 50ms | -41ms |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | 5 | 1 | 4 | 11 | 9 | 0 | 40ms | 50ms | -40ms |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | 1 | 0 | 1 | 15 | 6 | 0 | 41ms | 41ms | -41ms |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | 1 | 0 | 1 | 15 | 5 | 0 | 43ms | 43ms | -43ms |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 16 | 5 | 0 | 5 | 11 | 12 | 0 | 45ms | 48ms | -30ms |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 16 | 2 | 0 | 2 | 14 | 18 | 0 | 37ms | 39ms | +37ms |
| sheet-music-reading/fast.wav | 16 | 2 | 0 | 2 | 14 | 10 | 0 | 45ms | 47ms | -44ms |
| sheet-music-reading/medium.wav | 16 | 3 | 0 | 3 | 13 | 16 | 0 | 34ms | 36ms | +34ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | 1 | 0 | 1 | 15 | 3 | 0 | 36ms | 36ms | -36ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | 0 | 0 | 0 | 16 | 2 | 0 | - | - | - |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | 1 | 0 | 1 | 15 | 6 | 0 | 44ms | 44ms | -44ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | 2 | 0 | 2 | 14 | 4 | 0 | 43ms | 45ms | -42ms |
| sheet-music-reading/notenlesen1.wav | 16 | 3 | 0 | 3 | 13 | 5 | 0 | 42ms | 50ms | -42ms |
| sheet-music-reading/notenlesen2.wav | 16 | 2 | 0 | 2 | 14 | 1 | 0 | 45ms | 46ms | -45ms |

_Gesamttreffer: 50/320 (15.6%). good: 5 · acceptable: 45 · misses: 270 · false positives: 168_

## Onset Strategy Detail: guitar-onset-broadband-or

### Onset Count per Fixture
_Status: **exact** = Anzahl stimmt genau, **under** = zu wenig erkannt, **over** = zu viele erkannt, **mixed** = laut Tagged-Analyse beides (gleichzeitig fehlende und überschüssige Onsets)_

| fixture | expected notes | detected onsets | delta | status | onset times |
|---|---:|---:|---:|---|---|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | 18 | +2 | mixed | 3198ms 3813ms 4346ms 4920ms 5494ms 6027ms 6560ms 7175ms 7667ms 7790ms 8405ms 9020ms 9553ms 10168ms 10701ms 11193ms ... |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | 22 | +6 | mixed | 3239ms 3608ms 3772ms 4223ms 4674ms 5043ms 5248ms 5617ms 6232ms 6601ms 6765ms 7257ms 7626ms 7790ms 8323ms 8610ms ... |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | 25 | +9 | mixed | 1763ms 2050ms 2214ms 2706ms 3198ms 3649ms 4059ms 4551ms 5002ms 5125ms 5494ms 5822ms 5986ms 6273ms 6396ms 6519ms ... |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 16 | 21 | +5 | mixed | 1476ms 2952ms 3075ms 4428ms 4551ms 5945ms 7339ms 8938ms 9388ms 10618ms 12135ms 12258ms 13734ms 15702ms 17219ms 17342ms ... |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | 32 | +16 | mixed | 3116ms 4100ms 4592ms 5166ms 5453ms 6191ms 6724ms 7011ms 7175ms 8282ms 8446ms 8815ms 8979ms 9307ms 10250ms 10373ms ... |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 16 | 35 | +19 | mixed | 3936ms 4428ms 4879ms 5125ms 6027ms 6273ms 6478ms 6970ms 7503ms 7995ms 8487ms 9020ms 9143ms 10004ms 10578ms 11070ms ... |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | 17 | +1 | mixed | 1968ms 2624ms 3239ms 3895ms 4551ms 5166ms 5740ms 6396ms 7093ms 7790ms 8446ms 9102ms 9471ms 9758ms 10373ms 11070ms ... |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | 23 | +7 | mixed | 3485ms 4018ms 4551ms 4674ms 5248ms 5822ms 6355ms 6519ms 6970ms 7134ms 7831ms 8528ms 9225ms 9758ms 9922ms 10578ms ... |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | 18 | +2 | mixed | 2952ms 3526ms 4182ms 4838ms 5412ms 6027ms 6724ms 7298ms 7995ms 8405ms 8651ms 9307ms 10004ms 10619ms 11316ms 11685ms ... |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | 19 | +3 | mixed | 2009ms 2624ms 3239ms 3895ms 4510ms 4879ms 5125ms 5494ms 5740ms 6355ms 7011ms 7667ms 8036ms 8282ms 8979ms 9594ms ... |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 16 | 20 | +4 | mixed | 3239ms 3813ms 4141ms 4428ms 5043ms 5658ms 6109ms 6273ms 6970ms 7626ms 8036ms 8364ms 9061ms 9717ms 10332ms 10742ms ... |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 16 | 27 | +11 | mixed | 1230ms 2009ms 2214ms 2993ms 3239ms 4059ms 4223ms 4838ms 5248ms 5945ms 6273ms 7175ms 7913ms 8200ms 8692ms 9224ms ... |
| sheet-music-reading/fast.wav | 16 | 18 | +2 | mixed | 574ms 861ms 1107ms 1353ms 1640ms 1886ms 2173ms 2419ms 2665ms 2952ms 3198ms 3362ms 3485ms 3649ms 3977ms 4264ms ... |
| sheet-music-reading/medium.wav | 16 | 32 | +16 | mixed | 533ms 943ms 1271ms 1681ms 2050ms 2378ms 2788ms 3198ms 3567ms 3977ms 4387ms 4756ms 4961ms 5248ms 5576ms 5945ms ... |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | 16 | 0 | mixed | 1394ms 1763ms 2132ms 2542ms 2911ms 3280ms 3608ms 3977ms 4346ms 4715ms 5043ms 5412ms 5781ms 6150ms 6519ms 6847ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | 17 | +1 | mixed | 1435ms 1845ms 2050ms 2173ms 2542ms 2952ms 3280ms 3649ms 3977ms 4346ms 4715ms 5043ms 5453ms 5822ms 6150ms 6519ms ... |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | 16 | 0 | mixed | 1681ms 2050ms 2419ms 2788ms 3157ms 3485ms 3854ms 4223ms 4592ms 4961ms 5330ms 5699ms 6068ms 6355ms 6765ms 7134ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | 17 | +1 | mixed | 943ms 1353ms 1681ms 2050ms 2337ms 2460ms 2788ms 3157ms 3485ms 3854ms 4223ms 4592ms 4961ms 5330ms 5699ms 6027ms ... |
| sheet-music-reading/notenlesen1.wav | 16 | 16 | 0 | mixed | 2911ms 3567ms 4059ms 4633ms 5166ms 5699ms 6314ms 6929ms 7544ms 8159ms 8692ms 9266ms 9799ms 10373ms 10947ms 11521ms |
| sheet-music-reading/notenlesen2.wav | 16 | 16 | 0 | mixed | 3157ms 3772ms 4305ms 4838ms 5412ms 5986ms 6560ms 7134ms 7667ms 8282ms 8856ms 9471ms 10045ms 11193ms 11603ms 11767ms |

_Gesamt: 425/320 Onsets erkannt (132.8%). exact: 0 · under: 0 · over: 0 · mixed: 20_

### Tagged Onset Accuracy per Fixture
_Vergleich der erkannten Onsets mit manuell getaggten Referenzzeitpunkten (Toleranzfenster: 50 ms)._
_**good** = Treffer < 20 ms Abweichung, **acceptable** = Treffer < 50 ms, **misses** = Onset verpasst, **false positives** = Fehlalarm ohne Referenz in der Nähe, **bias** = mittlere Richtungsabweichung (negativ = zu früh gefeuert)_

| fixture | tags | hits | good | acceptable | misses | false positives | duplicates | mean abs | p95 abs | bias |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | 1 | 0 | 1 | 15 | 17 | 0 | 50ms | 50ms | -50ms |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | 1 | 0 | 1 | 15 | 21 | 0 | 49ms | 49ms | -49ms |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | 9 | 1 | 8 | 7 | 16 | 0 | 36ms | 50ms | -36ms |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 16 | 3 | 1 | 2 | 13 | 18 | 0 | 30ms | 36ms | +30ms |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | 6 | 1 | 5 | 10 | 26 | 0 | 39ms | 50ms | -39ms |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 16 | 1 | 0 | 1 | 15 | 34 | 0 | 49ms | 49ms | -49ms |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | 5 | 0 | 5 | 11 | 12 | 0 | 44ms | 50ms | -44ms |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | 3 | 0 | 3 | 13 | 20 | 0 | 42ms | 50ms | -16ms |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | 0 | 0 | 0 | 16 | 18 | 0 | - | - | - |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | 2 | 0 | 2 | 14 | 17 | 0 | 48ms | 49ms | -47ms |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 16 | 4 | 0 | 4 | 12 | 16 | 0 | 47ms | 48ms | -47ms |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 16 | 0 | 0 | 0 | 16 | 27 | 0 | - | - | - |
| sheet-music-reading/fast.wav | 16 | 3 | 0 | 3 | 13 | 15 | 0 | 45ms | 47ms | -45ms |
| sheet-music-reading/medium.wav | 16 | 0 | 0 | 0 | 16 | 32 | 0 | - | - | - |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | 2 | 0 | 2 | 14 | 14 | 0 | 49ms | 50ms | -49ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | 1 | 0 | 1 | 15 | 16 | 0 | 48ms | 48ms | -48ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | 4 | 0 | 4 | 12 | 12 | 0 | 41ms | 47ms | -41ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | 8 | 1 | 7 | 8 | 9 | 0 | 41ms | 49ms | -40ms |
| sheet-music-reading/notenlesen1.wav | 16 | 9 | 3 | 6 | 7 | 7 | 0 | 36ms | 50ms | -36ms |
| sheet-music-reading/notenlesen2.wav | 16 | 13 | 4 | 9 | 3 | 3 | 0 | 35ms | 49ms | -35ms |

_Gesamttreffer: 75/320 (23.4%). good: 11 · acceptable: 64 · misses: 245 · false positives: 350_

## Onset Strategy Detail: guitar-onset-legacy-bandpass

### Onset Count per Fixture
_Status: **exact** = Anzahl stimmt genau, **under** = zu wenig erkannt, **over** = zu viele erkannt, **mixed** = laut Tagged-Analyse beides (gleichzeitig fehlende und überschüssige Onsets)_

| fixture | expected notes | detected onsets | delta | status | onset times |
|---|---:|---:|---:|---|---|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | 10 | -6 | mixed | 3198ms 4346ms 4920ms 5494ms 7175ms 8405ms 9020ms 9553ms 10168ms 11931ms |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | 11 | -5 | mixed | 3239ms 3362ms 3772ms 5248ms 6765ms 7790ms 8323ms 8856ms 9348ms 10332ms 10824ms |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | 7 | -9 | mixed | 1763ms 2706ms 3649ms 4551ms 6396ms 7831ms 8733ms |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 16 | 19 | +3 | mixed | 1476ms 2952ms 3075ms 4428ms 5945ms 7339ms 8938ms 9388ms 10618ms 12135ms 13734ms 15702ms 17219ms 18695ms 18818ms 20171ms ... |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | 10 | -6 | mixed | 3157ms 4100ms 5166ms 10250ms 11275ms 12300ms 13284ms 14268ms 16400ms 17425ms |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 16 | 16 | 0 | mixed | 3936ms 4879ms 6027ms 6970ms 7995ms 9020ms 10004ms 11070ms 12054ms 13079ms 14063ms 15129ms 16154ms 17220ms 18163ms 19147ms |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | 14 | -2 | mixed | 1968ms 2624ms 3936ms 4551ms 5166ms 5740ms 6396ms 7093ms 7790ms 8446ms 9102ms 9799ms 11070ms 11726ms |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | 14 | -2 | mixed | 3485ms 4059ms 5248ms 5904ms 6519ms 7134ms 7831ms 8528ms 9225ms 9922ms 11275ms 11931ms 12628ms 13325ms |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | 7 | -9 | mixed | 2952ms 3526ms 4838ms 7298ms 8651ms 9307ms 10660ms |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | 7 | -9 | mixed | 2009ms 2624ms 4879ms 7667ms 9635ms 10988ms 11644ms |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 16 | 17 | +1 | mixed | 3239ms 3813ms 3936ms 4428ms 5043ms 5699ms 6273ms 6970ms 7626ms 8364ms 9061ms 9717ms 10332ms 11070ms 11726ms 12382ms ... |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 16 | 20 | +4 | mixed | 1230ms 2214ms 3239ms 4223ms 5248ms 6273ms 7175ms 7298ms 8200ms 9224ms 9798ms 10126ms 10249ms 10700ms 11110ms 12012ms ... |
| sheet-music-reading/fast.wav | 16 | 12 | -4 | mixed | 574ms 861ms 1107ms 1640ms 1886ms 2419ms 2952ms 3362ms 3731ms 3977ms 4510ms 4838ms |
| sheet-music-reading/medium.wav | 16 | 18 | +2 | mixed | 533ms 1271ms 1394ms 2050ms 2788ms 3567ms 4387ms 5248ms 5986ms 6683ms 7380ms 7503ms 8118ms 8815ms 9552ms 10331ms ... |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | 3 | -13 | mixed | 1394ms 1804ms 2132ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | 2 | -14 | mixed | 1435ms 1845ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | 7 | -9 | mixed | 1681ms 2050ms 2419ms 2788ms 3157ms 3854ms 5330ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | 6 | -10 | mixed | 943ms 2050ms 2788ms 3485ms 3895ms 5699ms |
| sheet-music-reading/notenlesen1.wav | 16 | 7 | -9 | mixed | 2911ms 5699ms 7544ms 9799ms 10373ms 10947ms 11521ms |
| sheet-music-reading/notenlesen2.wav | 16 | 3 | -13 | mixed | 3198ms 4305ms 7667ms |

_Gesamt: 210/320 Onsets erkannt (65.6%). exact: 0 · under: 0 · over: 0 · mixed: 20_

### Tagged Onset Accuracy per Fixture
_Vergleich der erkannten Onsets mit manuell getaggten Referenzzeitpunkten (Toleranzfenster: 50 ms)._
_**good** = Treffer < 20 ms Abweichung, **acceptable** = Treffer < 50 ms, **misses** = Onset verpasst, **false positives** = Fehlalarm ohne Referenz in der Nähe, **bias** = mittlere Richtungsabweichung (negativ = zu früh gefeuert)_

| fixture | tags | hits | good | acceptable | misses | false positives | duplicates | mean abs | p95 abs | bias |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | 1 | 0 | 1 | 15 | 9 | 0 | 50ms | 50ms | -50ms |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | 1 | 1 | 0 | 15 | 10 | 0 | 1ms | 1ms | +1ms |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | 4 | 0 | 4 | 12 | 3 | 0 | 38ms | 44ms | -38ms |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 16 | 2 | 1 | 1 | 14 | 17 | 0 | 26ms | 36ms | +26ms |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | 4 | 1 | 3 | 12 | 6 | 0 | 38ms | 50ms | -38ms |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 16 | 1 | 0 | 1 | 15 | 15 | 0 | 49ms | 49ms | -49ms |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | 8 | 0 | 8 | 8 | 6 | 0 | 41ms | 50ms | -41ms |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | 5 | 1 | 4 | 11 | 9 | 0 | 40ms | 50ms | -40ms |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | 1 | 0 | 1 | 15 | 6 | 0 | 41ms | 41ms | -41ms |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | 1 | 0 | 1 | 15 | 6 | 0 | 43ms | 43ms | -43ms |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 16 | 6 | 0 | 6 | 10 | 11 | 0 | 44ms | 48ms | -31ms |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 16 | 2 | 0 | 2 | 14 | 18 | 0 | 37ms | 39ms | +37ms |
| sheet-music-reading/fast.wav | 16 | 2 | 0 | 2 | 14 | 10 | 0 | 45ms | 47ms | -44ms |
| sheet-music-reading/medium.wav | 16 | 3 | 0 | 3 | 13 | 15 | 0 | 40ms | 50ms | +7ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | 1 | 0 | 1 | 15 | 2 | 0 | 36ms | 36ms | -36ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | 0 | 0 | 0 | 16 | 2 | 0 | - | - | - |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | 1 | 0 | 1 | 15 | 6 | 0 | 44ms | 44ms | -44ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | 2 | 0 | 2 | 14 | 4 | 0 | 43ms | 45ms | -42ms |
| sheet-music-reading/notenlesen1.wav | 16 | 2 | 0 | 2 | 14 | 5 | 0 | 45ms | 50ms | -44ms |
| sheet-music-reading/notenlesen2.wav | 16 | 2 | 1 | 1 | 14 | 1 | 0 | 25ms | 44ms | -24ms |

_Gesamttreffer: 49/320 (15.3%). good: 5 · acceptable: 44 · misses: 271 · false positives: 161_

## Default Strategy Detail
- evaluated: 20
- skipped: 0
- passed: 16
- failed: 4
- expected notes: 320
- accepted notes: 293
- detected onsets: 219
- onset confusion: TP=43 FP=176 FN=277
- tagged fixtures: 20
- tagged hits: 43/320
- tagged misses: 277
- tagged false positives: 176
- tagged duplicates: 0
- fixture pass rate: 80.0%
- note recall: 91.6%
- onset precision: 19.6%
- onset recall: 13.4%
- onset f1: 16.0%
- onset count ratio: 68.4%
- tagged hit rate: 13.4%
- good hit rate: 0.3%
- tagged mean abs error: 42ms
- tagged median abs error: 42ms
- tagged p95 abs error: 50ms
- tagged max abs error: 50ms
- tagged mean signed error: -40ms
- tagged early/late matches: 42/1
- frame cadence: 41ms
- onset frame size: 4096
- onset hop size: derived
- detector option overrides: none

## Guitar Onset Count
| fixture | expected notes | detected onsets | delta | status | onset times |
|---|---:|---:|---:|---|---|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | 11 | -5 | mixed | 3198ms 4346ms 4920ms 5494ms 7175ms 8405ms 9020ms 9553ms 10168ms 11316ms 11931ms |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | 11 | -5 | mixed | 3239ms 3403ms 3772ms 5248ms 6765ms 7790ms 8323ms 8856ms 9348ms 10332ms 10824ms |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | 8 | -8 | mixed | 1722ms 2214ms 2706ms 3649ms 4551ms 6396ms 6847ms 7831ms |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 16 | 18 | +2 | mixed | 1476ms 2952ms 4428ms 5945ms 7339ms 8938ms 9388ms 10618ms 12135ms 13734ms 15702ms 17219ms 18695ms 18859ms 20171ms 21606ms ... |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | 13 | -3 | mixed | 3116ms 4100ms 5166ms 7175ms 9307ms 10250ms 11275ms 12300ms 13284ms 14268ms 15293ms 16400ms 17425ms |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 16 | 17 | +1 | mixed | 3936ms 4879ms 6027ms 6970ms 7995ms 9020ms 10004ms 11070ms 12054ms 13079ms 14063ms 15129ms 16154ms 17220ms 18122ms 18286ms ... |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | 14 | -2 | mixed | 1968ms 3936ms 4551ms 5166ms 5740ms 6396ms 7093ms 7790ms 8446ms 9102ms 9799ms 10414ms 11070ms 11726ms |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | 14 | -2 | mixed | 3485ms 4059ms 5248ms 5904ms 6519ms 7134ms 7831ms 8528ms 9225ms 9922ms 11275ms 11931ms 12628ms 13325ms |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | 8 | -8 | mixed | 2952ms 3526ms 4838ms 7298ms 8651ms 9307ms 10660ms 11972ms |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | 7 | -9 | mixed | 2009ms 2624ms 4879ms 8077ms 9635ms 10988ms 11644ms |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 16 | 16 | 0 | mixed | 3239ms 3813ms 4428ms 5043ms 5658ms 6273ms 6970ms 7626ms 8364ms 9061ms 9717ms 10332ms 11070ms 11726ms 12382ms 13079ms |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 16 | 20 | +4 | mixed | 1230ms 2214ms 3239ms 4223ms 5248ms 6273ms 7175ms 7339ms 8200ms 9224ms 9798ms 10126ms 10290ms 10700ms 11110ms 12012ms ... |
| sheet-music-reading/fast.wav | 16 | 12 | -4 | mixed | 574ms 861ms 1107ms 1640ms 1886ms 2419ms 2952ms 3362ms 3731ms 3977ms 4510ms 4838ms |
| sheet-music-reading/medium.wav | 16 | 17 | +1 | mixed | 533ms 1271ms 2050ms 2788ms 3567ms 4387ms 5248ms 5945ms 6109ms 6683ms 7380ms 8118ms 8815ms 9552ms 10331ms 10987ms ... |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | 4 | -12 | mixed | 328ms 1394ms 1804ms 2132ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | 2 | -14 | mixed | 1435ms 1845ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | 9 | -7 | mixed | 1681ms 2050ms 2419ms 2788ms 3157ms 3854ms 5330ms 5699ms 6765ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | 7 | -9 | mixed | 943ms 2050ms 2788ms 3485ms 3895ms 4592ms 5699ms |
| sheet-music-reading/notenlesen1.wav | 16 | 8 | -8 | mixed | 2911ms 5166ms 5699ms 7544ms 9799ms 10373ms 10947ms 11521ms |
| sheet-music-reading/notenlesen2.wav | 16 | 3 | -13 | mixed | 3157ms 4305ms 7667ms |

## Onset Count Summary
| exact | under | over | mixed | TP | FP | FN | detected/expected | ratio | precision | recall | f1 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 0 | 20 | 43 | 176 | 277 | 219/320 | 68.4% | 19.6% | 13.4% | 16.0% |

## Tagged Onset Summary
| tagged fixtures | tagged onsets | good hits | acceptable hits | misses | false positives | duplicates | hit rate | good hit rate | mean abs | p95 abs | bias |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | 320 | 1 | 42 | 277 | 176 | 0 | 13.4% | 0.3% | 42ms | 50ms | -40ms |

## Tagged Onset Detail
| fixture | tags | hits | good | acceptable | misses | false positives | duplicates | mean abs | p95 abs | bias |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | 1 | 0 | 1 | 15 | 10 | 0 | 50ms | 50ms | -50ms |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | 1 | 0 | 1 | 15 | 10 | 0 | 42ms | 42ms | +42ms |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | 3 | 0 | 3 | 13 | 5 | 0 | 37ms | 40ms | -37ms |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 16 | 0 | 0 | 0 | 16 | 18 | 0 | - | - | - |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | 3 | 0 | 3 | 13 | 10 | 0 | 45ms | 50ms | -45ms |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 16 | 1 | 0 | 1 | 15 | 16 | 0 | 49ms | 49ms | -49ms |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | 9 | 0 | 9 | 7 | 5 | 0 | 41ms | 50ms | -41ms |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | 5 | 1 | 4 | 11 | 9 | 0 | 40ms | 50ms | -40ms |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | 2 | 0 | 2 | 14 | 6 | 0 | 42ms | 42ms | -41ms |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | 1 | 0 | 1 | 15 | 6 | 0 | 43ms | 43ms | -43ms |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 16 | 4 | 0 | 4 | 12 | 12 | 0 | 47ms | 48ms | -47ms |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 16 | 0 | 0 | 0 | 16 | 20 | 0 | - | - | - |
| sheet-music-reading/fast.wav | 16 | 2 | 0 | 2 | 14 | 10 | 0 | 45ms | 47ms | -44ms |
| sheet-music-reading/medium.wav | 16 | 0 | 0 | 0 | 16 | 17 | 0 | - | - | - |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | 1 | 0 | 1 | 15 | 3 | 0 | 36ms | 36ms | -36ms |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | 0 | 0 | 0 | 16 | 2 | 0 | - | - | - |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | 2 | 0 | 2 | 14 | 7 | 0 | 42ms | 44ms | -41ms |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | 3 | 0 | 3 | 13 | 4 | 0 | 45ms | 49ms | -45ms |
| sheet-music-reading/notenlesen1.wav | 16 | 3 | 0 | 3 | 13 | 5 | 0 | 42ms | 50ms | -42ms |
| sheet-music-reading/notenlesen2.wav | 16 | 2 | 0 | 2 | 14 | 1 | 0 | 45ms | 46ms | -45ms |

## Onset Feature Detail
| fixture | frames | onset frames | peak hfcΔ | peak centroidΔ | peak rolloffΔ | peak flatnessΔ | peak crestΔ | peak flux | peak subband fluxes | onset hfcΔ | onset centroidΔ | onset rolloffΔ | onset flatnessΔ | onset crestΔ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 357 | 11 | 0.873 | 5369 | 11871 | 0.501 | 5.159 | 0.000 | 0.019 / 0.010 / 0.000 | 0.272 | 445.1 | -763.8 | -0.043 | -0.010 |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 322 | 11 | 1.462 | 5285 | 13313 | 0.470 | 5.875 | 0.000 | 0.022 / 0.015 / 0.000 | 0.318 | 195.0 | -42.61 | -0.029 | 0.003 |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 266 | 8 | 0.252 | 4813 | 9035 | 0.375 | 6.594 | 0.000 | 0.007 / 0.005 / 0.000 | 0.031 | 220.1 | 51.27 | -0.059 | -0.078 |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 660 | 18 | 4.644 | 6201 | 8721 | 0.641 | 9.481 | 0.001 | 0.056 / 0.025 / 0.001 | 0.084 | -623.7 | -385.2 | -0.100 | 1.648 |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 526 | 13 | 0.190 | 2984 | 8695 | 0.307 | 7.527 | 0.000 | 0.008 / 0.006 / 0.000 | 0.028 | -246.7 | -631.9 | -0.109 | 0.680 |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 590 | 17 | 0.208 | 3573 | 10641 | 0.350 | 13.25 | 0.000 | 0.015 / 0.008 / 0.000 | 0.028 | -1932 | -426.0 | -0.234 | -0.381 |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 367 | 14 | 0.560 | 3092 | 8613 | 0.397 | 5.938 | 0.000 | 0.007 / 0.006 / 0.000 | 0.264 | 709.4 | 242.7 | -0.048 | -0.281 |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 396 | 14 | 2.554 | 6123 | 9223 | 0.568 | 6.148 | 0.000 | 0.012 / 0.010 / 0.000 | 0.370 | 288.6 | -376.7 | -0.045 | 1.323 |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 388 | 8 | 0.795 | 5550 | 10359 | 0.544 | 7.160 | 0.000 | 0.027 / 0.008 / 0.000 | 0.185 | -114.1 | -1102 | -0.064 | -0.176 |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 367 | 7 | 2.183 | 3867 | 10137 | 0.431 | 6.492 | 0.001 | 0.007 / 0.006 / 0.000 | 0.595 | 441.6 | 2613 | -0.114 | -0.703 |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 402 | 16 | 2.342 | 6112 | 9012 | 0.505 | 16.44 | 0.001 | 0.033 / 0.007 / 0.001 | 0.423 | 1196 | 635.7 | -0.003 | 0.337 |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 444 | 20 | 4.311 | 4448 | 19272 | 0.395 | 8.603 | 0.001 | 0.041 / 0.016 / 0.000 | 0.099 | -533.3 | -11.84 | -0.059 | 1.321 |
| sheet-music-reading/fast.wav | 146 | 12 | 4.297 | 7256 | 18486 | 0.581 | 9.059 | 0.001 | 0.034 / 0.013 / 0.001 | 0.788 | 568.0 | 60.11 | 0.025 | -0.580 |
| sheet-music-reading/medium.wav | 316 | 17 | 4.514 | 8064 | 18325 | 0.701 | 25.82 | 0.001 | 0.041 / 0.024 / 0.000 | 0.206 | -1331 | 60.17 | -0.154 | 1.757 |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 212 | 4 | 1.241 | 7827 | 16840 | 0.640 | 2.408 | 0.000 | 0.034 / 0.007 / 0.000 | 0.196 | -684.9 | 20.51 | -0.073 | -0.469 |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 215 | 2 | 1.450 | 5354 | 9609 | 0.561 | 2.839 | 0.000 | 0.039 / 0.008 / 0.000 | 0.055 | -2488 | -462.9 | -0.268 | -0.106 |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 206 | 9 | 1.939 | 3747 | 20027 | 0.360 | 3.985 | 0.000 | 0.021 / 0.020 / 0.000 | 0.455 | -139.8 | -69.01 | -0.030 | -0.107 |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 206 | 7 | 1.429 | 3712 | 10477 | 0.389 | 3.487 | 0.000 | 0.030 / 0.014 / 0.000 | 0.425 | -375.7 | -30.13 | -0.051 | 0.348 |
| sheet-music-reading/notenlesen1.wav | 357 | 8 | 0.098 | 4770 | 10629 | 0.445 | 5.587 | 0.000 | 0.006 / 0.005 / 0.000 | 0.034 | -496.4 | -1154 | -0.108 | 0.499 |
| sheet-music-reading/notenlesen2.wav | 358 | 3 | 0.089 | 5836 | 11250 | 0.528 | 9.369 | 0.000 | 0.006 / 0.004 / 0.000 | 0.019 | -1600 | -3137 | -0.177 | -2.703 |

## Onset To Accept Alignment
| fixture | expected notes | detected onsets | accepted notes | missing onsets | missing accepts | mismatches | avg onset->accept | first issue |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | 11 | 16 | 5 | 0 | 0 | -2028ms | 12:missing-onset |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | 11 | 15 | 5 | 0 | 0 | -2098ms | 12:missing-onset |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | 8 | 16 | 8 | 0 | 0 | -1174ms | 9:missing-onset |
| sheet-music-reading/4-4_40bpm_EGADB_9low6.wav | 16 | 18 | 16 | 0 | 0 | 0 | 805ms | - |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | 13 | 16 | 3 | 0 | 0 | -2359ms | 14:missing-onset |
| sheet-music-reading/4-4_59bpm_EA_ghpgq.wav | 16 | 17 | 16 | 0 | 0 | 0 | -946ms | - |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | 14 | 16 | 2 | 0 | 0 | -2539ms | 15:missing-onset |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | 14 | 16 | 2 | 0 | 0 | -1904ms | 15:missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | 8 | 16 | 8 | 0 | 0 | -2619ms | 9:missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | 7 | 16 | 9 | 0 | 0 | -3385ms | 8:missing-onset |
| sheet-music-reading/4-4_91bpm_GEB_u25pb.wav | 16 | 16 | 16 | 0 | 0 | 0 | -320ms | - |
| sheet-music-reading/eeeeaaaaddddgggg.wav | 16 | 20 | 16 | 0 | 0 | 0 | -202ms | - |
| sheet-music-reading/fast.wav | 16 | 12 | 6 | 4 | 6 | 0 | 376ms | 7:missing-accept |
| sheet-music-reading/medium.wav | 16 | 17 | 16 | 0 | 0 | 0 | 320ms | - |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | 4 | 8 | 12 | 0 | 0 | 185ms | 5:missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | 2 | 8 | 14 | 0 | 0 | 41ms | 3:missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | 9 | 16 | 7 | 0 | 0 | -765ms | 10:missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | 7 | 16 | 9 | 0 | 0 | -1406ms | 8:missing-onset |
| sheet-music-reading/notenlesen1.wav | 16 | 8 | 16 | 8 | 0 | 0 | -3500ms | 9:missing-onset |
| sheet-music-reading/notenlesen2.wav | 16 | 3 | 16 | 13 | 0 | 0 | -1462ms | 4:missing-onset |

## Onset To Accept Issues
| fixture | # | expected | onset time | accepted | accept time | onset->accept | status |
|---|---:|---:|---:|---:|---:|---:|---|
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 12 | A2 | - | A2 | 9061ms | - | missing-onset |
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 13 | G3 | - | G3 | 9102ms | - | missing-onset |
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 14 | A2 | - | A2 | 9143ms | - | missing-onset |
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 15 | A2 | - | A2 | 9184ms | - | missing-onset |
| sheet-music-reading/4-4_103bpm_ADG_keomz.wav | 16 | G3 | - | G3 | 9225ms | - | missing-onset |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 12 | G3 | - | G3 | 8405ms | - | missing-onset |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 13 | D3 | - | D3 | 9348ms | - | missing-onset |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 14 | D3 | - | D3 | 9389ms | - | missing-onset |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 15 | A2 | - | A2 | 9676ms | - | missing-onset |
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 16 | G3 | - | - | - | - | missing-onset |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 9 | E2 | - | E2 | 5494ms | - | missing-onset |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 10 | E2 | - | E2 | 5535ms | - | missing-onset |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 11 | E2 | - | E2 | 5576ms | - | missing-onset |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 12 | E2 | - | E2 | 5617ms | - | missing-onset |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 13 | E2 | - | E2 | 5658ms | - | missing-onset |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 14 | E2 | - | E2 | 5699ms | - | missing-onset |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 15 | A2 | - | A2 | 8282ms | - | missing-onset |
| sheet-music-reading/4-4_130bpm_EA_ou91c.wav | 16 | E2 | - | E2 | 8692ms | - | missing-onset |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 14 | E2 | - | E2 | 11480ms | - | missing-onset |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 15 | A2 | - | A2 | 17425ms | - | missing-onset |
| sheet-music-reading/4-4_59bpm_EA_80clx.wav | 16 | E2 | - | E2 | 18286ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 15 | G3 | - | G3 | 10455ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GBE_jmkkc.wav | 16 | B3 | - | B3 | 10865ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 15 | G3 | - | G3 | 12095ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GBE_lgned.wav | 16 | B3 | - | B3 | 12505ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 9 | D3 | - | D3 | 7995ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 10 | D3 | - | D3 | 8036ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 11 | G3 | - | G3 | 8446ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 12 | D3 | - | D3 | 8651ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 13 | B3 | - | B3 | 10660ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 14 | D3 | - | D3 | 10906ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 15 | B3 | - | B3 | 10947ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_bsr80.wav | 16 | D3 | - | D3 | 10988ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 8 | G3 | - | G3 | 5248ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 9 | D3 | - | D3 | 7011ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 10 | D3 | - | D3 | 7052ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 11 | G3 | - | G3 | 7093ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 12 | D3 | - | D3 | 7134ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 13 | B3 | - | B3 | 9635ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 14 | D3 | - | D3 | 10373ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 15 | B3 | - | B3 | 10660ms | - | missing-onset |
| sheet-music-reading/4-4_91bpm_GDAB_q6ntm.wav | 16 | D3 | - | D3 | 10701ms | - | missing-onset |
| sheet-music-reading/fast.wav | 7 | B3 | 2952ms | - | - | - | missing-accept |
| sheet-music-reading/fast.wav | 8 | G3 | 3362ms | - | - | - | missing-accept |
| sheet-music-reading/fast.wav | 9 | D3 | 3731ms | - | - | - | missing-accept |
| sheet-music-reading/fast.wav | 10 | A2 | 3977ms | - | - | - | missing-accept |
| sheet-music-reading/fast.wav | 11 | E2 | 4510ms | - | - | - | missing-accept |
| sheet-music-reading/fast.wav | 12 | A2 | 4838ms | - | - | - | missing-accept |
| sheet-music-reading/fast.wav | 13 | D3 | - | - | - | - | missing-onset |
| sheet-music-reading/fast.wav | 14 | G3 | - | - | - | - | missing-onset |
| sheet-music-reading/fast.wav | 15 | B3 | - | - | - | - | missing-onset |
| sheet-music-reading/fast.wav | 16 | E4 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 5 | D3 | - | D3 | 3157ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 6 | A2 | - | A2 | 3280ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 7 | G3 | - | G3 | 3895ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 8 | A2 | - | A2 | 3977ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 9 | G3 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 10 | D3 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 11 | A2 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 12 | A2 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 13 | D3 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 14 | A2 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 15 | D3 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 16 | D3 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 3 | D3 | - | D3 | 1927ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 4 | A2 | - | A2 | 2583ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 5 | D3 | - | D3 | 3198ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 6 | A2 | - | A2 | 3280ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 7 | G3 | - | G3 | 3895ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 8 | A2 | - | A2 | 4018ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 9 | G3 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 10 | D3 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 11 | A2 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 12 | A2 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 13 | D3 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 14 | A2 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 15 | D3 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 16 | D3 | - | - | - | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 10 | B3 | - | B3 | 5699ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 11 | D3 | - | D3 | 5740ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 12 | B3 | - | B3 | 5781ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 13 | B3 | - | B3 | 5822ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 14 | B3 | - | B3 | 6068ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 15 | G3 | - | G3 | 6806ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_tszjn.wav | 16 | E2 | - | E2 | 7134ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 8 | D3 | - | D3 | 3526ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 9 | G3 | - | G3 | 3895ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 10 | B3 | - | B3 | 4264ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 11 | D3 | - | D3 | 4346ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 12 | B3 | - | B3 | 4428ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 13 | B3 | - | B3 | 4469ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 14 | B3 | - | B3 | 4510ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 15 | G3 | - | G3 | 6068ms | - | missing-onset |
| sheet-music-reading/notenlesen_4-4_161bpm_EGBD_y18iz.wav | 16 | E2 | - | E2 | 6396ms | - | missing-onset |
| sheet-music-reading/notenlesen1.wav | 9 | A2 | - | A2 | 7544ms | - | missing-onset |
| sheet-music-reading/notenlesen1.wav | 10 | A2 | - | A2 | 7585ms | - | missing-onset |
| sheet-music-reading/notenlesen1.wav | 11 | E2 | - | E2 | 7995ms | - | missing-onset |
| sheet-music-reading/notenlesen1.wav | 12 | A2 | - | A2 | 8159ms | - | missing-onset |
| sheet-music-reading/notenlesen1.wav | 13 | A2 | - | A2 | 8200ms | - | missing-onset |
| sheet-music-reading/notenlesen1.wav | 14 | A2 | - | A2 | 8241ms | - | missing-onset |
| sheet-music-reading/notenlesen1.wav | 15 | A2 | - | A2 | 8282ms | - | missing-onset |
| sheet-music-reading/notenlesen1.wav | 16 | A2 | - | A2 | 8323ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 4 | E2 | - | E2 | 4879ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 5 | E2 | - | E2 | 4920ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 6 | E2 | - | E2 | 4961ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 7 | E2 | - | E2 | 5002ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 8 | A2 | - | A2 | 7134ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 9 | A2 | - | A2 | 7175ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 10 | E2 | - | E2 | 7626ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 11 | E2 | - | E2 | 8282ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 12 | A2 | - | A2 | 9471ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 13 | E2 | - | E2 | 10045ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 14 | E2 | - | E2 | 10086ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 15 | E2 | - | E2 | 10127ms | - | missing-onset |
| sheet-music-reading/notenlesen2.wav | 16 | E2 | - | E2 | 10168ms | - | missing-onset |

## Failures
| fixture | accepted notes | expected | accepted |
|---|---:|---|---|
| sheet-music-reading/4-4_120bpm_AGD_r5c07.wav | 15/16 | A2 A2 G3 D3 D3 A2 D3 A2 D3 A2 G3 G3 D3 D3 A2 G3 | A2 A2 G3 D3 D3 A2 D3 A2 D3 A2 G3 G3 D3 D3 A2 |
| sheet-music-reading/fast.wav | 6/16 | E2 A2 D3 G3 B3 E4 B3 G3 D3 A2 E2 A2 D3 G3 B3 E4 | E2 A2 D3 G3 B3 E4 |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_px4kc.wav | 8/16 | D3 G3 D3 A2 D3 A2 G3 A2 G3 D3 A2 A2 D3 A2 D3 D3 | D3 G3 D3 A2 D3 A2 G3 A2 |
| sheet-music-reading/notenlesen_4-4_161bpm_DGA_w7e7b.wav | 8/16 | D3 G3 D3 A2 D3 A2 G3 A2 G3 D3 A2 A2 D3 A2 D3 D3 | D3 G3 D3 A2 D3 A2 G3 A2 |

## Skipped
| fixture | reason |
|---|---|

---

# Sheet Music Note Fingerprint

- fixtures: 41 note WAVs
- target pitches: 14 (A2, A3, B2, B3, C4, D3, E2, E3, E4, F2, F3, F4, G2, G3)
- strategies: fast-note-matcher, essentia-pitch-yin

## Strategy Summary
| strategy | TP | FP | FN | TN | recall | specificity | precision | accuracy | f1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fast-note-matcher | 41 | 5 | 0 | 528 | 100.0% | 99.1% | 89.1% | 99.1% | 94.3% |
| essentia-pitch-yin | 41 | 5 | 0 | 528 | 100.0% | 99.1% | 89.1% | 99.1% | 94.3% |

## Default Strategy Detail
- pitch matrix: 574 probes (41 expected positives, 533 expected negatives)
- confusion: TP=41 FP=5 FN=0 TN=528
- sensitivity/recall: 100.0%
- specificity: 99.1%
- precision: 89.1%
- accuracy: 99.1%
- f1: 94.3%
- false positive rate: 0.9%
- false negative rate: 0.0%

## False Positives
| kind | source file | source pitch | target pitch | detected | frame | cents |
|---|---|---:|---:|---:|---|---:|
| FP | A2/a2k.wav | A2 | A3 | A3 | correct | 0.0c |
| FP | E2/e2-2.wav | E2 | E3 | E3 | correct | 0.0c |
| FP | E2/e2.wav | E2 | E3 | E3 | correct | 0.0c |
| FP | F2/f2.wav | F2 | F3 | F3 | correct | 0.0c |
| FP | f2.wav | F2 | F3 | F3 | correct | 0.0c |

## False Negatives
| kind | source file | source pitch | target pitch | detected | frame | cents |
|---|---|---:|---:|---:|---|---:|

## Single-Note Onset Goldens
- fixtures: 41
- passed: 41
- failed: 0
- missing goldens: 0

## Onset Failures
| status | fixture | pitch |
|---|---|---:|
