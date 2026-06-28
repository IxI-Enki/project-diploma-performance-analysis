from pathlib import Path
path = Path(r"D:\_Repositories\00_Die_Farm\24_project_diploma_performance_analysis\scripts\fetch_mteb_de.py")
text = path.read_text(encoding="utf-8")

task_block = '''MTEB_DE_TASK_TYPES: dict[str, str] = {
    "AmazonCounterfactualClassification": "Classification",
    "AmazonReviewsClassification": "Classification",
    "MTOPDomainClassification": "Classification",
    "MTOPIntentClassification": "Classification",
    "MassiveIntentClassification": "Classification",
    "MassiveScenarioClassification": "Classification",
    "BlurbsClusteringP2P": "Clustering",
    "BlurbsClusteringS2S": "Clustering",
    "TenKGnadClusteringP2P": "Clustering",
    "TenKGnadClusteringS2S": "Clustering",
    "FalseFriendsGermanEnglish": "PairClassification",
    "PawsXPairClassification": "PairClassification",
    "MIRACLReranking": "Reranking",
    "GermanQuAD-Retrieval": "Retrieval",
    "GermanDPR": "Retrieval",
    "XMarket": "Retrieval",
    "GerDaLIR": "Retrieval",
    "GermanSTSBenchmark": "STS",
    "STS22": "STS",
}
'''

if "MTEB_DE_TASK_TYPES" not in text:
    text = text.replace(
        'MTEB_DE_BENCHMARK = "MTEB(deu, v1)"\n',
        'MTEB_DE_BENCHMARK = "MTEB(deu, v1)"\n' + task_block,
    )

old_fn = '''def _mteb_de_task_types() -> dict[str, str]:
    import mteb

    bench = mteb.get_benchmark(MTEB_DE_BENCHMARK)
    return {task.metadata.name: task.metadata.type for task in bench.tasks}


'''
text = text.replace(old_fn, "")

text = text.replace(
    "    warnings.filterwarnings(\"ignore\", category=UserWarning, module=\"mteb\")\n    type_by_task = _mteb_de_task_types()\n",
    "    type_by_task = MTEB_DE_TASK_TYPES\n",
)

path.write_text(text, encoding="utf-8")
print("[OK] hardcoded DE task types")
