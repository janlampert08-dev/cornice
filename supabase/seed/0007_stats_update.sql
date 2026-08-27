-- Höhe/Steigung/Kehren neu berechnet via swisstopo-Höhenprofil (swissALTI3D).
-- Generiert von scripts/generate-stats-update-sql.mjs.

update public.routes set hoehe_m = 2283, max_steigung_prozent = 12, kehren = 26 where name = 'Julierpass';
update public.routes set hoehe_m = 1948, max_steigung_prozent = 8.4, kehren = 26 where name = 'Klausenpass';
update public.routes set hoehe_m = 2227, max_steigung_prozent = 9.1, kehren = 21 where name = 'Sustenpass';
update public.routes set hoehe_m = 2384, max_steigung_prozent = 9.8, kehren = 20 where name = 'Flüelapass';
update public.routes set hoehe_m = 791, max_steigung_prozent = 8.2, kehren = 7 where name = 'Albispass';
update public.routes set hoehe_m = 728, max_steigung_prozent = 10.6, kehren = 3 where name = 'Forch-Höhenstrasse';
update public.routes set hoehe_m = 848, max_steigung_prozent = 15.8, kehren = 11 where name = 'Uetliberg';
update public.routes set hoehe_m = 443, max_steigung_prozent = 4.2, kehren = 7 where name = 'Reusstal';
update public.routes set hoehe_m = 791, max_steigung_prozent = 7.5, kehren = 17 where name = 'Zimmerberg-Rundfahrt';
