<?php
// =============================================
// Hontrio — API-ul de citire al extensiei (OpenCart 3.0.x).
// index.php?route=extension/hontrio/api&action=...  cu antetul X-Hontrio-Key.
// Contractul: docs/integrari/OPENCART.md; logica e în system/library/hontrio/core.php.
// =============================================
class ControllerExtensionHontrioApi extends Controller {
	public function index() {
		require_once DIR_SYSTEM . 'library/hontrio/core.php';

		$core = new HontrioCore($this->registry);
		$core->handle();
	}
}
