/**
 * core-state.js
 * Central state management and taxonomy definitions.
 */

export const AppState = {
  currentView: 'grid', // 'grid', 'folders', 'timeline'
  selectedEntryId: null,
  currentImageIndex: 0,
  activeTaxonomy: null, // 'brand', 'era', etc.
  language: localStorage.getItem('lexicon-lang') || 'en',
  filters: {
    brand: null,
    era: null,
    politics: null,
    theories: null,
    gender: null,
    materials: null,
    geography: null,
    format: null,
    anatomy: null
  },
  searchQuery: '',
  archivalFolders: [],
  activeFolderId: null,
  previousView: 'grid',
  fidelityMode: localStorage.getItem('lexicon-fidelity') || 'forensic', // 'forensic', 'aesthetic'
};

export let gridIntersectionObserver = null;
export function setGridIntersectionObserver(observer) {
  gridIntersectionObserver = observer;
}

export const stickyNotes = {
  critique:   { color: '#FF0000', title: 'FORENSIC CRITIQUE',   body: '' },
  strategy:   { color: '#0000FF', title: 'ISOLATE STRATEGY',   body: '' },
  provenance: { color: '#E6FF00', title: 'AUDIT PROVENANCE', body: '' },
};

export function updateHash(id) {
  if (id) {
    window.location.hash = id;
  } else {
    // Clear hash without jump
    history.pushState("", document.title, window.location.pathname + window.location.search);
  }
}

export const taxonomyData = {
  brand: [
    'Acne Studios', 'Alexander McQueen', 'Alexander Wang', 'Altuzarra', 'Ann Demeulemeester', 'Anna Sui', 'Azzedine Alaïa', 'Balenciaga', 'Balmain', 'Bode', 'Bottega Veneta', 'Brunello Cucinelli', 'Burberry', 'Calvin Klein', 'Carolina Herrera', 'Celine', 'Chanel', 'Chloé', 'Christian Dior', 'Christian Lacroix', 'Christopher Kane', 'Comme des Garçons', 'Coperni', 'Courrèges', 'Craig Green', 'Diesel', 'Dolce & Gabbana', 'Donna Karan', 'Dries Van Noten', 'Dsquared2', 'Erdem', 'Ermenegildo Zegna', 'Etro', 'Fear of God', 'Fendi', 'Ganni', 'Gareth Pugh', 'Giorgio Armani', 'Givenchy', 'Gucci', 'Haider Ackermann', 'Helmut Lang', 'Hermès', 'Hussein Chalayan', 'Issey Miyake', 'JW Anderson', 'Jacquemus', 'Jean Paul Gaultier', 'Jil Sander', 'John Galliano', 'Junya Watanabe', 'Kenzo', 'Khaite', 'Kiko Kostadinov', 'Lanvin', 'Loewe', 'Loro Piana', 'Louis Vuitton', 'Maison Margiela', 'Marc Jacobs', 'Marine Serre', 'Max Mara', 'Michael Kors', 'Missoni', 'Miu Miu', 'Moschino', 'Noir Kei Ninomiya', 'Off-White', 'Oscar de la Renta', 'Paco Rabanne', 'Prada', 'Proenza Schouler', 'Ralph Lauren', 'Richard Quinn', 'Rick Owens', 'Roberto Cavalli', 'Roksanda', 'Sacai', 'Saint Laurent', 'Salvatore Ferragamo', 'Schiaparelli', 'Simone Rocha', 'Stella McCartney', 'Telfar', 'The Row', 'Thierry Mugler', 'Thom Browne', 'Tod\'s', 'Tom Ford', 'Trussardi', 'Undercover', 'Valentino', 'Versace', 'Vetements', 'Viktor & Rolf', 'Vivienne Westwood', 'Wales Bonner', 'Walter Van Beirendonck', 'Y/Project', 'Yohji Yamamoto'
  ],
  era: [
    '1980 to 1989; The Post-Modern Shift',
    '1990 to 1999; The Deconstructionist Decade',
    '2000 to 2009; The Global Conglomerate Era',
    '2010 to 2019; The Digital and Streetwear Pivot',
    '2020 to Present; The Post-Pandemic and Surrealist Current'
  ],
  politics: [
    'Queer Theory & Subcultural Systems',
    'Gender Deconstruction & Fluidity',
    'Body Politics & Corporeal Interventions',
    'Class Dynamics & Anti-Elitism',
    'Post-Colonialism & Diasporic Narratives',
    'Anti-Consumerism & Institutional Critique',
    'Activism & Crisis Response',
    'Globalisation & Cultural Hybridity',
    'Surveillance & Architectural Shielding',
    'Ecological Politics & Resource Extraction',
    'Labour Politics & Industrial Production',
    'Feminist Theory & The Subverted Gaze',
    'Racial Identity & Representation',
    'Censorship & Provocation',
    'Techno-Politics & Digital Identities'
  ],
  theories: [
    'Subcultural Resistance Theory',
    'Habitus and Field (Bourdieu)',
    'Trickle-Down and Bubble-Up Dynamics',
    'Institutional Critique',
    'Corporate Nihilism',
    'Class Distinctions and Signalling',
    'Structuralism and Sign Systems',
    'Mythology and Contemporary Lore (Barthes)',
    'Visual Rhetoric',
    'Symbolic Exchange',
    'Narrative Curation',
    'Deconstructionist Logic (Derrida)',
    'Queer Performativity (Butler)',
    'The Subverted Gaze',
    'Intersectionality',
    'Psychoanalytic Theory (Lacanian)',
    'The Mirror Stage',
    'Bodily Autonomy and Transgression',
    'Gender Deconstruction',
    'Biopolitics and Bio-Power (Foucault)',
    'Panoptic Surveillance',
    'Post-Colonial Critique',
    'The Society of the Spectacle (Debord)',
    'Marxist Materialism',
    'Affect Theory',
    'Globalisation and Diaspora',
    'The Simulacrum (Baudrillard)',
    'Hauntology (Fisher)',
    'Camp and Kitsch Subversion',
    'Object-Oriented Ontology',
    'Radical Romanticism',
    'Brutalist Information Architecture',
    'The Grotesque and Abject',
    'Cyborg Manifestos (Haraway)',
    'Post-Humanism',
    'Algorithmic Determinism',
    'Digital Dualism',
    'Techno-Optimism and Accelerationism',
    'Remediation',
    'Hyperreality'
  ],
  gender: [
    'Menswear', 'Womenswear', 'Unisex / Neutral', 'Conceptual / Post-Binary Form'
  ],
  materials: [
    'Animal Protein Fibres', 'Plant-Based Cellulose', 'Bovine & Exotic Skins', 'Fine Precious Metallics', 'Biological Ephemera', 'Petroleum-Based Polymers', 'Thermoplastic Membranes', 'Elastomeric Compounds', 'Cellulosic Semi-Synthetics', 'Industrial Coatings', 'High-Performance Textiles', 'Structural Composites', 'Non-Woven Industrial Membranes', 'Smart & Kinetic Textiles', 'Reflective & Refractive Media', 'Lab-Grown Organics', '3D Printed Polymers', 'Laser-Cut & Ultrasonic Welded', 'Additive Manufacturing', 'Molecularly Engineered Bio-Plastics', 'Upcycled Industrial Waste', 'Domestic Found Objects', 'Artificially Degraded Textiles', 'Deadstock & Surplus Inventory', 'Assembled Non-Textile Hardware'
  ],
  geography: [
    'Paris (Chambre Syndicale)', 'Paris (Fédération de la Haute Couture)', 'Milan (Camera Nazionale)', 'London (BFC)', 'New York (CFDA)', 'Tokyo (Rakuten Fashion Week)', 'Shanghai / Seoul', 'Alternative Capital', 'Non-Capital Site', 'Site-Specific Intervention', 'Industrial / Warehouse Site', 'Digital / Meta-Geographic Space', 'Private / Salon Presentation', 'Street / Guerrilla Site', 'The Antwerp Scene', 'Tokyo Avant-Garde', 'Japanese Minimalist System', 'French Bourgeois Tradition', 'Italian Industrial Excellence', 'Mediterranean Vernacular', 'American Utilitarianism', 'American Minimalist (Nineties)', 'British Eccentricity', 'London Underground / Club Culture', 'NYC Ballroom', 'Nordic / Scandinavian Functionalism', 'Eastern Bloc / Post-Soviet Archive', 'Latin American Surrealism / Craft', 'Global South / Indigenous', 'Diasporic Narrative / Hybrid Identity', 'Pan-European Luxury Hegemony', 'Subcultural Origin', 'Academic / Institutional Lineage', 'Digital-Native / Algorithm-Led', 'Retro-Futurist Heritage', 'Historical Revisionist / Period Archive', 'Corporate / Executive Nihilism', 'Neoclassical / Sacred Iconography'
  ],
  format: [
    'Traditional Runway', 'Circular / Arena Format', 'Theatrical Stage Performance', 'Site-Specific Intervention', 'Guerrilla / Street Presentation', 'Gallery / Museum Installation', 'Static Presentation', 'Salon / Intimate Appointment', 'Immersive Environment', 'Performance Art / Live Action', 'Kinetic / Mechanical Runway', 'Public / Open-Access Spectacle', 'Pop-Up / Temporary Structure', 'Live Streamed Event', 'Fashion Film / Cinematic Narrative', 'Lookbook / Still Photography', 'Social Media Native Campaign', 'Augmented Reality (AR)', '3D Rendered Environment', 'Editorial Exclusive Release', 'Archival / Found Footage Assemblage', 'Interactive Web Experience', 'Documentary / BTS Format', 'Television / Broadcast Special', 'Virtual Showroom / Portal'
  ],
  anatomy: [
    'Monolithic Massing', 'Radical Asymmetry', 'Compressed Proportions', 'Geometric Abstraction', 'Linear Elongation', 'Negative Space and Void', 'Deconstructed Assembly', 'Tailored Rigidity', 'Modular Componentry', 'Suspended Drape', 'Scaffolding and Internal Frameworks', 'Bias-Cut Fluidity', 'Sartorial Restriction', 'Prosthetic Extension', 'Architectural Shielding and Armour', 'Clinical Exposure and Nudity', 'Displaced Anatomy and Padding', 'Bodily Obfuscation', 'Mechanical Fluidity', 'Structural Stasis', 'Weight and Gravity Defiance', 'Adaptive Transformation', 'Pendulous Motion', 'Topographic Layering', 'Pleat and Fold Architecture', 'Surface Erosion and Degradation', 'Planar Distortion', 'Membrane and Transparency'
  ]
};
