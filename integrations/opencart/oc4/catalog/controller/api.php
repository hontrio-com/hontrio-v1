<?php
// =============================================
// Hontrio — API-ul de citire al extensiei (OpenCart 4.x).
// index.php?route=extension/hontrio/api&action=...  cu antetul X-Hontrio-Key.
// Contractul: docs/integrari/OPENCART.md; logica e în system/library/core.php.
// =============================================
namespace Opencart\Catalog\Controller\Extension\Hontrio;

class Api extends \Opencart\System\Engine\Controller {
	public function index(): void {
		require_once DIR_EXTENSION . 'hontrio/system/library/core.php';

		$core = new \HontrioCore($this->registry);
		$core->handle();
	}
}
