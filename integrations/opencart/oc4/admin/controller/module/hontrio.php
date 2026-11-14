<?php
// =============================================
// Hontrio — panoul extensiei (OpenCart 4.x): Extensii → Module → Hontrio.
// Cheia (copiere, cheie nouă), API-ul pornit / oprit, salvarea sursei comenzilor.
// La instalare: tabelul sursei, evenimentele (codul `hontrio`) și cheia;
// la dezinstalare se șterg toate trei.
//
// Separatorul metodei în rute: `|` până la 4.0.1.x, `.` de la 4.0.2.0.
// Evenimentele modelelor: `checkout/order/addOrder` în 4.0, `checkout/order.addOrder`
// în 4.1 — se înregistrează amândouă (cea care nu se potrivește versiunii nu pornește niciodată).
// =============================================
namespace Opencart\Admin\Controller\Extension\Hontrio\Module;

class Hontrio extends \Opencart\System\Engine\Controller {
	public function index(): void {
		$this->load->language('extension/hontrio/module/hontrio');
		$this->document->setTitle($this->language->get('heading_title'));
		$this->load->model('setting/setting');

		$token = 'user_token=' . $this->session->data['user_token'];
		$separator = $this->separator();

		$data['breadcrumbs'] = [];
		$data['breadcrumbs'][] = [
			'text' => $this->language->get('text_home'),
			'href' => $this->url->link('common/dashboard', $token)
		];
		$data['breadcrumbs'][] = [
			'text' => $this->language->get('text_extension'),
			'href' => $this->url->link('marketplace/extension', $token . '&type=module')
		];
		$data['breadcrumbs'][] = [
			'text' => $this->language->get('heading_title'),
			'href' => $this->url->link('extension/hontrio/module/hontrio', $token)
		];

		$data['save'] = $this->url->link('extension/hontrio/module/hontrio' . $separator . 'save', $token);
		$data['regenerate'] = $this->url->link('extension/hontrio/module/hontrio' . $separator . 'regenerate', $token);
		$data['back'] = $this->url->link('marketplace/extension', $token . '&type=module');

		$setting = $this->model_setting_setting->getSetting('module_hontrio');
		$data['installed'] = !empty($setting['module_hontrio_key']);
		$data['key'] = $setting['module_hontrio_key'] ?? '';
		$data['module_hontrio_status'] = !empty($setting['module_hontrio_status']);
		$data['module_hontrio_tracking'] = !empty($setting['module_hontrio_tracking']);

		$data['store_url'] = rtrim(HTTP_CATALOG, '/');
		$data['text_step_2'] = sprintf($this->language->get('text_step_2'), $data['store_url']);

		$data['header'] = $this->load->controller('common/header');
		$data['column_left'] = $this->load->controller('common/column_left');
		$data['footer'] = $this->load->controller('common/footer');

		$this->response->setOutput($this->load->view('extension/hontrio/module/hontrio', $data));
	}

	public function save(): void {
		$this->load->language('extension/hontrio/module/hontrio');

		$json = [];

		if (!$this->user->hasPermission('modify', 'extension/hontrio/module/hontrio')) {
			$json['error'] = $this->language->get('error_permission');
		}

		if (!$json) {
			$this->load->model('setting/setting');
			$this->store(!empty($this->request->post['module_hontrio_status']), !empty($this->request->post['module_hontrio_tracking']), false);
			$json['success'] = $this->language->get('text_success');
		}

		$this->response->addHeader('Content-Type: application/json');
		$this->response->setOutput(json_encode($json));
	}

	/** „Generează o cheie nouă”: cea veche nu mai merge. */
	public function regenerate(): void {
		$this->load->language('extension/hontrio/module/hontrio');

		$json = [];

		if (!$this->user->hasPermission('modify', 'extension/hontrio/module/hontrio')) {
			$json['error'] = $this->language->get('error_permission');
		}

		if (($this->request->server['REQUEST_METHOD'] ?? '') !== 'POST') {
			$json['error'] = $this->language->get('error_method');
		}

		if (!$json) {
			$this->load->model('setting/setting');
			$setting = $this->model_setting_setting->getSetting('module_hontrio');
			$json['key'] = $this->store(!empty($setting['module_hontrio_status']), !empty($setting['module_hontrio_tracking']), true);
			$json['success'] = $this->language->get('text_key_regenerated');
		}

		$this->response->addHeader('Content-Type: application/json');
		$this->response->setOutput(json_encode($json));
	}

	public function install(): void {
		require_once DIR_EXTENSION . 'hontrio/system/library/core.php';
		$this->load->model('setting/setting');
		$this->load->model('setting/event');

		\HontrioCore::createTable($this->db);

		$this->model_setting_event->deleteEventByCode('hontrio');

		$action = 'extension/hontrio/event' . $this->separator();
		$events = [
			['catalog/controller/common/header/before', $action . 'header', 'Hontrio: the visit source (UTM, gclid) goes into the session'],
			['catalog/model/checkout/order/addOrder/after', $action . 'addOrder', 'Hontrio: the visit source is saved on the new order (OpenCart 4.0)'],
			['catalog/model/checkout/order.addOrder/after', $action . 'addOrder', 'Hontrio: the visit source is saved on the new order (OpenCart 4.1)'],
			['catalog/model/checkout/order/editOrder/after', $action . 'editOrder', 'Hontrio: the visit source is saved on the edited order if missing (OpenCart 4.0)'],
			['catalog/model/checkout/order.editOrder/after', $action . 'editOrder', 'Hontrio: the visit source is saved on the edited order if missing (OpenCart 4.1)']
		];

		foreach ($events as [$trigger, $route, $description]) {
			if (version_compare(VERSION, '4.0.1.0', '>=')) {
				$this->model_setting_event->addEvent([
					'code'        => 'hontrio',
					'description' => $description,
					'trigger'     => $trigger,
					'action'      => $route,
					'status'      => true,
					'sort_order'  => 0
				]);
			} else {
				$this->model_setting_event->addEvent('hontrio', $description, $trigger, $route, true, 0);
			}
		}

		$now = date('c');
		$this->model_setting_setting->editSetting('module_hontrio', [
			'module_hontrio_status'         => 1,
			'module_hontrio_tracking'       => 1,
			'module_hontrio_key'            => \HontrioCore::newKey(),
			'module_hontrio_tracking_since' => $now,
			'module_hontrio_installed'      => $now
		]);
	}

	public function uninstall(): void {
		require_once DIR_EXTENSION . 'hontrio/system/library/core.php';
		$this->load->model('setting/setting');
		$this->load->model('setting/event');

		$this->model_setting_event->deleteEventByCode('hontrio');
		$this->model_setting_setting->deleteSetting('module_hontrio');

		\HontrioCore::dropTable($this->db);
	}

	/** Setările păstrează cheia (sau fac una nouă) și data de la care se salvează sursa. Întoarce cheia. */
	private function store(bool $status, bool $tracking, bool $newKey): string {
		require_once DIR_EXTENSION . 'hontrio/system/library/core.php';

		$current = $this->model_setting_setting->getSetting('module_hontrio');
		$key = !$newKey && !empty($current['module_hontrio_key']) ? $current['module_hontrio_key'] : \HontrioCore::newKey();
		$since = !empty($current['module_hontrio_tracking_since']) ? $current['module_hontrio_tracking_since'] : date('c');
		if ($tracking && empty($current['module_hontrio_tracking'])) {
			$since = date('c');
		}

		$this->model_setting_setting->editSetting('module_hontrio', [
			'module_hontrio_status'         => $status ? 1 : 0,
			'module_hontrio_tracking'       => $tracking ? 1 : 0,
			'module_hontrio_key'            => $key,
			'module_hontrio_tracking_since' => $since,
			'module_hontrio_installed'      => !empty($current['module_hontrio_installed']) ? $current['module_hontrio_installed'] : date('c')
		]);

		return $key;
	}

	private function separator(): string {
		return version_compare(VERSION, '4.0.2.0', '>=') ? '.' : '|';
	}
}
