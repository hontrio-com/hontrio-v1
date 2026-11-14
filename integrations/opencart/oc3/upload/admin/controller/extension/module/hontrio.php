<?php
// =============================================
// Hontrio — panoul extensiei (OpenCart 3.0.x): Extensii → Module → Hontrio.
// Cheia (copiere, cheie nouă), API-ul pornit / oprit, salvarea sursei comenzilor.
// La instalare: tabelul sursei, evenimentele (codul `hontrio`) și cheia;
// la dezinstalare se șterg toate trei.
// =============================================
class ControllerExtensionModuleHontrio extends Controller {
	private $error = array();

	public function index() {
		$this->load->language('extension/module/hontrio');
		$this->document->setTitle($this->language->get('heading_title'));
		$this->load->model('setting/setting');

		if ($this->request->server['REQUEST_METHOD'] == 'POST' && $this->validate()) {
			$this->store(!empty($this->request->post['module_hontrio_status']), !empty($this->request->post['module_hontrio_tracking']), false);

			$this->session->data['success'] = $this->language->get('text_success');

			$this->response->redirect($this->url->link('extension/module/hontrio', 'user_token=' . $this->session->data['user_token'], true));
		}

		$data['error_warning'] = isset($this->error['warning']) ? $this->error['warning'] : '';

		if (isset($this->session->data['success'])) {
			$data['success'] = $this->session->data['success'];
			unset($this->session->data['success']);
		} else {
			$data['success'] = '';
		}

		$data['breadcrumbs'] = array();
		$data['breadcrumbs'][] = array(
			'text' => $this->language->get('text_home'),
			'href' => $this->url->link('common/dashboard', 'user_token=' . $this->session->data['user_token'], true)
		);
		$data['breadcrumbs'][] = array(
			'text' => $this->language->get('text_extension'),
			'href' => $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true)
		);
		$data['breadcrumbs'][] = array(
			'text' => $this->language->get('heading_title'),
			'href' => $this->url->link('extension/module/hontrio', 'user_token=' . $this->session->data['user_token'], true)
		);

		$data['action'] = $this->url->link('extension/module/hontrio', 'user_token=' . $this->session->data['user_token'], true);
		$data['regenerate'] = $this->url->link('extension/module/hontrio/regenerate', 'user_token=' . $this->session->data['user_token'], true);
		$data['cancel'] = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true);

		$setting = $this->model_setting_setting->getSetting('module_hontrio');
		$data['installed'] = !empty($setting['module_hontrio_key']);
		$data['key'] = isset($setting['module_hontrio_key']) ? $setting['module_hontrio_key'] : '';
		$data['module_hontrio_status'] = !empty($setting['module_hontrio_status']);
		$data['module_hontrio_tracking'] = !empty($setting['module_hontrio_tracking']);

		$catalog = defined('HTTPS_CATALOG') && HTTPS_CATALOG ? HTTPS_CATALOG : HTTP_CATALOG;
		$data['store_url'] = rtrim($catalog, '/');
		$data['text_step_2'] = sprintf($this->language->get('text_step_2'), $data['store_url']);

		$data['header'] = $this->load->controller('common/header');
		$data['column_left'] = $this->load->controller('common/column_left');
		$data['footer'] = $this->load->controller('common/footer');

		$this->response->setOutput($this->load->view('extension/module/hontrio', $data));
	}

	/** „Generează o cheie nouă”: cea veche nu mai merge. */
	public function regenerate() {
		$this->load->language('extension/module/hontrio');
		$this->load->model('setting/setting');

		if ($this->request->server['REQUEST_METHOD'] == 'POST' && $this->validate()) {
			$setting = $this->model_setting_setting->getSetting('module_hontrio');
			$this->store(!empty($setting['module_hontrio_status']), !empty($setting['module_hontrio_tracking']), true);
			$this->session->data['success'] = $this->language->get('text_key_regenerated');
		}

		$this->response->redirect($this->url->link('extension/module/hontrio', 'user_token=' . $this->session->data['user_token'], true));
	}

	public function install() {
		require_once DIR_SYSTEM . 'library/hontrio/core.php';
		$this->load->model('setting/setting');
		$this->load->model('setting/event');

		HontrioCore::createTable($this->db);

		$this->model_setting_event->deleteEventByCode('hontrio');
		$this->model_setting_event->addEvent('hontrio', 'catalog/controller/common/header/before', 'extension/hontrio/event/header');
		$this->model_setting_event->addEvent('hontrio', 'catalog/model/checkout/order/addOrder/after', 'extension/hontrio/event/addOrder');
		$this->model_setting_event->addEvent('hontrio', 'catalog/model/checkout/order/editOrder/after', 'extension/hontrio/event/editOrder');

		$now = date('c');
		$this->model_setting_setting->editSetting('module_hontrio', array(
			'module_hontrio_status'         => 1,
			'module_hontrio_tracking'       => 1,
			'module_hontrio_key'            => HontrioCore::newKey(),
			'module_hontrio_tracking_since' => $now,
			'module_hontrio_installed'      => $now
		));
	}

	public function uninstall() {
		require_once DIR_SYSTEM . 'library/hontrio/core.php';
		$this->load->model('setting/setting');
		$this->load->model('setting/event');

		$this->model_setting_event->deleteEventByCode('hontrio');
		$this->model_setting_setting->deleteSetting('module_hontrio');

		HontrioCore::dropTable($this->db);
	}

	/** Setările păstrează cheia (sau fac una nouă) și data de la care se salvează sursa. */
	protected function store($status, $tracking, $newKey) {
		require_once DIR_SYSTEM . 'library/hontrio/core.php';

		$current = $this->model_setting_setting->getSetting('module_hontrio');
		$key = !$newKey && !empty($current['module_hontrio_key']) ? $current['module_hontrio_key'] : HontrioCore::newKey();
		$since = !empty($current['module_hontrio_tracking_since']) ? $current['module_hontrio_tracking_since'] : date('c');
		if ($tracking && empty($current['module_hontrio_tracking'])) {
			$since = date('c');
		}

		$this->model_setting_setting->editSetting('module_hontrio', array(
			'module_hontrio_status'         => $status ? 1 : 0,
			'module_hontrio_tracking'       => $tracking ? 1 : 0,
			'module_hontrio_key'            => $key,
			'module_hontrio_tracking_since' => $since,
			'module_hontrio_installed'      => !empty($current['module_hontrio_installed']) ? $current['module_hontrio_installed'] : date('c')
		));
	}

	protected function validate() {
		if (!$this->user->hasPermission('modify', 'extension/module/hontrio')) {
			$this->error['warning'] = $this->language->get('error_permission');
		}

		return !$this->error;
	}
}
