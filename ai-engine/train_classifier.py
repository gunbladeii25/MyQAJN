"""
Train Agent A classifier — TF-IDF + Logistic Regression
Run once: python train_classifier.py
Output: models/classifier_model.pkl
"""
import os
import json
import joblib
import numpy as np
from pathlib import Path
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.metrics import classification_report

MODELS_PATH = Path(os.getenv("MODELS_PATH", "./models"))
MODELS_PATH.mkdir(exist_ok=True)

# ── Training data — bilingual, covers all 4 categories ───────────────────────
TRAINING_DATA = [
    # ── Facilities ────────────────────────────────────────────────────────────
    ("tandas sekolah rosak dan tidak berfungsi selama sebulan", "Facilities"),
    ("bangunan kantin bocor dan berbahaya kepada pelajar", "Facilities"),
    ("infrastruktur dewan sekolah perlu dibaiki segera", "Facilities"),
    ("bekalan elektrik di bilik darjah sering terputus", "Facilities"),
    ("paip air di blok sains telah rosak menyebabkan banjir", "Facilities"),
    ("peralatan makmal sains tidak berfungsi dan perlu diganti", "Facilities"),
    ("padang sekolah dalam keadaan yang tidak selamat", "Facilities"),
    ("ubahsuai kantin tidak mengikut spesifikasi yang ditetapkan", "Facilities"),
    ("komputer di makmal ICT sudah usang dan perlu diganti", "Facilities"),
    ("toilet facilities broken and unusable for weeks", "Facilities"),
    ("school building infrastructure damaged after heavy rain", "Facilities"),
    ("canteen roof leaking causing safety hazard to students", "Facilities"),
    ("electrical wiring in classrooms poses danger", "Facilities"),
    ("laboratory equipment damaged and needs replacement", "Facilities"),
    ("school field flooded and unsafe for activities", "Facilities"),
    ("renovation works not completed as per contract", "Facilities"),
    ("air conditioning units in classrooms not functioning", "Facilities"),
    ("school bus in poor condition failing safety checks", "Facilities"),
    ("kemudahan sukan tidak mencukupi untuk pelajar", "Facilities"),
    ("bilik guru dalam keadaan sesak dan tidak selesa", "Facilities"),

    # ── Academic_Quality ──────────────────────────────────────────────────────
    ("pencapaian akademik pelajar merosot dalam peperiksaan SPM", "Academic_Quality"),
    ("skor SKPMG2 sekolah jauh lebih rendah daripada sasaran KPM", "Academic_Quality"),
    ("keputusan UPSR menunjukkan kemerosotan yang membimbangkan", "Academic_Quality"),
    ("kualiti PDPC guru tidak memenuhi standard yang ditetapkan", "Academic_Quality"),
    ("prestasi akademik pelajar dalam PT3 sangat rendah tahun ini", "Academic_Quality"),
    ("kurikulum sekolah tidak dilaksanakan mengikut panduan KPM", "Academic_Quality"),
    ("guru tidak melaksanakan pengajaran pembelajaran yang berkualiti", "Academic_Quality"),
    ("band pencapaian sekolah menurun dari band 3 ke band 5", "Academic_Quality"),
    ("markah pentaksiran berasaskan sekolah tidak dikemaskini", "Academic_Quality"),
    ("student academic performance dropped significantly in national exams", "Academic_Quality"),
    ("SKPMG2 score shows major discrepancy with actual assessment", "Academic_Quality"),
    ("curriculum implementation does not follow KPM guidelines", "Academic_Quality"),
    ("teacher quality and teaching methods below standard", "Academic_Quality"),
    ("school achievement band dropped from band 2 to band 4", "Academic_Quality"),
    ("assessment records incomplete and not updated properly", "Academic_Quality"),
    ("SPM results show decline in core subjects performance", "Academic_Quality"),
    ("academic quality monitoring not conducted as scheduled", "Academic_Quality"),
    ("gred mata pelajaran teras jatuh berbanding tahun lepas", "Academic_Quality"),
    ("data pencapaian pelajar tidak dikemaskini dalam sistem EMIS", "Academic_Quality"),
    ("program pemulihan akademik tidak dilaksanakan dengan berkesan", "Academic_Quality"),

    # ── Discipline ────────────────────────────────────────────────────────────
    ("kes buli berlaku di sekolah melibatkan pelajar tingkatan tiga", "Discipline"),
    ("pelajar didapati membawa dadah ke dalam kawasan sekolah", "Discipline"),
    ("kes ponteng semakin meningkat tanpa tindakan dari pihak sekolah", "Discipline"),
    ("pergaduhan antara pelajar menyebabkan kecederaan serius", "Discipline"),
    ("vandalisma harta benda sekolah oleh pelajar nakal", "Discipline"),
    ("pelajar didapati merokok di dalam kawasan sekolah", "Discipline"),
    ("salah laku pelajar tidak ditangani mengikut prosedur tatatertib", "Discipline"),
    ("kes buang sekolah meningkat kerana masalah disiplin yang kronik", "Discipline"),
    ("kelakuan tidak sopan pelajar terhadap guru dilaporkan", "Discipline"),
    ("student bullying incident reported involving multiple students", "Discipline"),
    ("drug possession found among students in school compound", "Discipline"),
    ("high truancy rate with no proper disciplinary action taken", "Discipline"),
    ("serious fight between students resulting in injuries", "Discipline"),
    ("vandalism of school property by students", "Discipline"),
    ("students caught smoking within school premises", "Discipline"),
    ("misconduct cases not handled according to disciplinary procedures", "Discipline"),
    ("suspension and expulsion rates increasing due to behavior issues", "Discipline"),
    ("students showing disrespectful behavior towards teachers", "Discipline"),
    ("tingkah laku pelajar yang mengganggu proses pembelajaran", "Discipline"),
    ("laporan buli siber melibatkan pelajar sekolah ini", "Discipline"),

    # ── Administrative_Misconduct ─────────────────────────────────────────────
    ("penyelewengan kewangan ditemui dalam audit dalaman sekolah", "Administrative_Misconduct"),
    ("rekod palsu dimasukkan dalam sistem EMIS oleh pihak pengurusan", "Administrative_Misconduct"),
    ("pemalsuan data pencapaian sekolah untuk elak tindakan JN", "Administrative_Misconduct"),
    ("salah guna wang peruntukan pembangunan sekolah dilaporkan", "Administrative_Misconduct"),
    ("kontrak pembinaan diberi kepada kontraktor tanpa tender terbuka", "Administrative_Misconduct"),
    ("manipulasi data skor SKPMG2 untuk mengelak audit Jemaah Nazir", "Administrative_Misconduct"),
    ("kes rasuah melibatkan pengetua dan kontraktor luar dilaporkan SPRM", "Administrative_Misconduct"),
    ("salah urus kewangan sekolah menyebabkan kerugian besar", "Administrative_Misconduct"),
    ("perubahan data melibatkan sekolah tanpa kebenaran pihak berkuasa", "Administrative_Misconduct"),
    ("financial misappropriation found during school internal audit", "Administrative_Misconduct"),
    ("false records submitted to EMIS system by school management", "Administrative_Misconduct"),
    ("data falsification to avoid Jemaah Nazir inspection findings", "Administrative_Misconduct"),
    ("misuse of development funds allocated to school", "Administrative_Misconduct"),
    ("contract awarded without proper open tender process", "Administrative_Misconduct"),
    ("data manipulation in SKPMG2 scores to mislead auditors", "Administrative_Misconduct"),
    ("corruption case involving headmaster reported to SPRM", "Administrative_Misconduct"),
    ("financial mismanagement causing significant losses to school", "Administrative_Misconduct"),
    ("unauthorized changes to school data in official systems", "Administrative_Misconduct"),
    ("procurement irregularities found in school spending records", "Administrative_Misconduct"),
    ("fraud detected in school fee collection and accounting", "Administrative_Misconduct"),

    # ── Extra edge cases ──────────────────────────────────────────────────────
    ("data pelajar diubah tanpa kebenaran dalam pangkalan data", "Administrative_Misconduct"),
    ("skor operasi yang dilaporkan tidak sepadan dengan rekod sebenar", "Administrative_Misconduct"),
    ("maklumat palsu dihantar kepada KPM untuk tujuan penarafan", "Administrative_Misconduct"),
    ("pelajar cemerlang dalam kokurikulum tetapi lemah dalam akademik", "Academic_Quality"),
    ("infrastruktur sekolah lama perlu dinaik taraf dengan segera", "Facilities"),
    ("disiplin pelajar perlu diperkukuh melalui program intervensi", "Discipline"),
]

texts  = [t for t, _ in TRAINING_DATA]
labels = [l for _, l in TRAINING_DATA]

# ── Build pipeline ────────────────────────────────────────────────────────────
pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(
        ngram_range=(1, 3),
        min_df=1,
        max_features=5000,
        sublinear_tf=True,
    )),
    ('clf', LogisticRegression(
        C=2.0,
        max_iter=1000,
        class_weight='balanced',
        random_state=42,
    )),
])

# ── Cross-validation ─────────────────────────────────────────────────────────
print("Training classifier...")
scores = cross_val_score(pipeline, texts, labels, cv=4, scoring='accuracy')
print(f"Cross-validation accuracy: {scores.mean():.3f} ± {scores.std():.3f}")

# ── Train on full dataset ─────────────────────────────────────────────────────
pipeline.fit(texts, labels)

# ── Quick evaluation ──────────────────────────────────────────────────────────
preds = pipeline.predict(texts)
print("\nClassification Report (train set):")
print(classification_report(labels, preds))

# ── Test with real case text ──────────────────────────────────────────────────
test_cases = [
    "perubahan data melibatkan sekolah",
    "pelajar buli rakan sebaya di kantin",
    "bangunan sekolah rosak teruk",
    "pencapaian SPM merosot tahun ini",
]
print("\nTest predictions:")
for text in test_cases:
    pred = pipeline.predict([text])[0]
    proba = pipeline.predict_proba([text])[0]
    conf = max(proba)
    print(f"  [{conf:.0%}] '{text}' -> {pred}")

# ── Save model ────────────────────────────────────────────────────────────────
model_path = MODELS_PATH / "classifier_model.pkl"
joblib.dump(pipeline, model_path)
print(f"\nModel saved: {model_path}")
print("Agent A will now use ML classification instead of rule_based.")
