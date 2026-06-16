(function () {
  'use strict';

  var charts = {};
  var data = null;
  var currentTask = 'retrieval';
  var LOGO_BASE = 'showcase_kit/img/logos/';

  function t(en, de) {
    var lang = document.documentElement.lang || 'en';
    return lang === 'de' ? de : en;
  }

  function renderMeta(manifest, payload) {
    var el = document.getElementById('data-meta');
    if (!el || !manifest) return;
    var source = (payload && payload.source) || (manifest.sources && manifest.sources[0]) || manifest.source || '-';
    el.textContent = t(
      'Last updated: ' + Showcase.formatDate(manifest.generated_at, 'en') + ' · Source: ' + source,
      'Stand: ' + Showcase.formatDate(manifest.generated_at, 'de') + ' · Quelle: ' + source
    );
  }

  function logoForModel(modelId) {
    var id = (modelId || '').toLowerCase();
    if (id.indexOf('mistralai/') === 0) return LOGO_BASE + 'mistral.svg';
    if (id.indexOf('intfloat/') === 0 || id.indexOf('/e5') !== -1) return LOGO_BASE + 'microsoft.svg';
    if (id.indexOf('deutsche-telekom/') === 0 || id.indexOf('gbert') !== -1) return LOGO_BASE + 'telekom.svg';
    if (id.indexOf('baai/') === 0 || id.indexOf('bge') !== -1) return LOGO_BASE + 'baai.svg';
    if (id.indexOf('jina') !== -1) return LOGO_BASE + 'jina.svg';
    if (id.indexOf('sentence-transformers/') === 0) return LOGO_BASE + 'huggingface.svg';
    return null;
  }

  function modelLogoHtml(modelId) {
    var src = logoForModel(modelId);
    if (!src) return '';
    return '<img class="model-logo" src="' + src + '" alt="" loading="lazy" width="28" height="28">';
  }

  function renderLeaderboard(models) {
    var tbody = document.querySelector('#leaderboard-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    models.slice(0, 20).forEach(function (m, i) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (i + 1) + '</td>' +
        '<td class="model-cell">' + modelLogoHtml(m.model_id) + '<span class="mono">' + m.model_id + '</span></td>' +
        '<td><strong>' + m.avg_score.toFixed(2) + '</strong></td>' +
        '<td>' + (m.tasks.retrieval != null ? m.tasks.retrieval.toFixed(1) : '-') + '</td>' +
        '<td>' + (m.tasks.clustering != null ? m.tasks.clustering.toFixed(1) : '-') + '</td>' +
        '<td>' + (m.tasks.classification != null ? m.tasks.classification.toFixed(1) : '-') + '</td>' +
        '<td>' + (m.params_m != null ? (m.params_m >= 1000 ? (m.params_m / 1000).toFixed(1) + 'B' : m.params_m + 'M') : '-') + '</td>';
      tbody.appendChild(tr);
    });
  }

  function topForTask(models, task, n) {
    return models
      .filter(function (m) { return m.tasks[task] != null; })
      .sort(function (a, b) { return b.tasks[task] - a.tasks[task]; })
      .slice(0, n || 8);
  }

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function renderTaskChart(task) {
    var canvas = document.getElementById('task-chart');
    if (!canvas || !data) return;
    destroyChart('task');
    var subset = topForTask(data.models, task, 8).reverse();
    var colors = Showcase.chartColors();
    charts.task = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: subset.map(function (m) { return Showcase.wrapLabel(m.model_id.split('/').pop(), 22); }),
        datasets: [{
          label: task,
          data: subset.map(function (m) { return m.tasks[task]; }),
          backgroundColor: colors.primary,
          borderColor: colors.ink,
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: Showcase.tooltipTitle } }
        },
        scales: {
          x: { beginAtZero: true, title: { display: true, text: t('Score (higher is better)', 'Score (höher ist besser)') } }
        }
      }
    });
  }

  function setupTaskFilters() {
    document.querySelectorAll('[data-task-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentTask = btn.getAttribute('data-task-filter');
        document.querySelectorAll('[data-task-filter]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderTaskChart(currentTask);
      });
    });
  }

  function setupPicker() {
    var state = { goal: null, resource: null };
    var result = document.getElementById('picker-result');

    function updateResult() {
      if (!result || !data) return;
      if (!state.goal || !state.resource) {
        result.hidden = true;
        return;
      }
      var pick;
      if (state.goal === 'retrieval') {
        pick = topForTask(data.models, 'retrieval', 1)[0];
      } else if (state.goal === 'clustering') {
        pick = topForTask(data.models, 'clustering', 1)[0];
      } else {
        pick = data.models[0];
      }
      if (state.resource === 'small' && pick) {
        var small = data.models.filter(function (m) { return (m.params_m || 9999) <= 600; });
        if (state.goal === 'retrieval') pick = topForTask(small, 'retrieval', 1)[0] || pick;
        else if (state.goal === 'clustering') pick = topForTask(small, 'clustering', 1)[0] || pick;
        else pick = small[0] || pick;
      }
      result.hidden = false;
      result.innerHTML =
        '<span class="picker-result-model">' + modelLogoHtml(pick.model_id) +
        '<b>' + (pick ? pick.model_id : '-') + '</b></span><span>' +
        t('Starting point from MTEB DE scores — validate on your corpus before production.',
          'Ausgangspunkt laut MTEB-DE-Scores — auf eigenem Korpus vor Produktion validieren.') +
        '</span>';
    }

    document.querySelectorAll('[data-picker]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-picker');
        var group = btn.getAttribute('data-picker-group');
        state[group] = key;
        document.querySelectorAll('[data-picker-group="' + group + '"]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        updateResult();
      });
    });
  }

  function init() {
    Promise.all([
      Showcase.loadJson('data/mteb_de_leaderboard.json'),
      Showcase.loadJson('data/manifest.json')
    ]).then(function (res) {
      data = res[0];
      renderMeta(res[1], data);
      renderLeaderboard(data.models);
      renderTaskChart(currentTask);
      setupTaskFilters();
      setupPicker();
    }).catch(function () {
      Showcase.showOfflineBanner(true);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
