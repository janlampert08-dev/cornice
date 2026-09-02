// Dünne Re-Export-Wrapper um lucide-react (siehe package.json) statt der
// bisherigen handgezeichneten Inline-SVGs — gleicher { className }-Vertrag,
// gleiche Importnamen, damit lib/nav.ts und alle Konsumenten unverändert
// bleiben. lucide-react ist tree-shakeable (Einzel-Imports), daher kein
// Bundle-Size-Nachteil ggü. den bisherigen 5 Icons.
export { MapPin as MapPinIcon, Trophy as RankingIcon, User as PersonIcon, Plus as PlusIcon, ShieldCheck as ShieldIcon, Users as FeedIcon, Circle as RecordIcon } from "lucide-react";
