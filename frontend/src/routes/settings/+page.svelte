<script>
	import { m } from '$lib/paraglide/messages';
</script>

<div class="mx-auto max-w-7xl pt-16 lg:flex lg:gap-x-16 lg:px-8">
	<h1 class="sr-only">General Settings</h1>

	<main class="px-4 py-16 sm:px-6 lg:flex-auto lg:px-0 lg:py-20">
		<div class="mx-auto max-w-2xl space-y-16 sm:space-y-20 lg:mx-0 lg:max-w-none">
			<div>
				<h2 class="text-base/7 font-semibold text-gray-900">Profile</h2>
				<p class="mt-1 text-sm/6 text-gray-500">
					This information will be displayed publicly so be careful what you share.
				</p>

				<dl class="mt-6 divide-y divide-gray-100 border-t border-gray-200 text-sm/6">
					<div class="py-6 sm:flex">
						<dt class="font-medium text-gray-900 sm:w-64 sm:flex-none sm:pr-6">Full name</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<div class="text-gray-900">Tom Cook</div>
							<button type="button" class="font-semibold text-indigo-600 hover:text-indigo-500"
								>Update</button
							>
						</dd>
					</div>
					<div class="py-6 sm:flex">
						<dt class="font-medium text-gray-900 sm:w-64 sm:flex-none sm:pr-6">Email address</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<div class="text-gray-900">tom.cook@example.com</div>
							<button type="button" class="font-semibold text-indigo-600 hover:text-indigo-500"
								>Update</button
							>
						</dd>
					</div>
					<div class="py-6 sm:flex">
						<dt class="font-medium text-gray-900 sm:w-64 sm:flex-none sm:pr-6">Title</dt>
						<dd class="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
							<div class="text-gray-900">Human Resources Manager</div>
							<button type="button" class="font-semibold text-indigo-600 hover:text-indigo-500"
								>Update</button
							>
						</dd>
					</div>
				</dl>
			</div>

			<div>
				<h2 class="text-base/7 font-semibold text-gray-900">Bank accounts</h2>
				<p class="mt-1 text-sm/6 text-gray-500">Connect bank accounts to your account.</p>

				<ul role="list" class="mt-6 divide-y divide-gray-100 border-t border-gray-200 text-sm/6">
					<li class="flex justify-between gap-x-6 py-6">
						<div class="font-medium text-gray-900">TD Canada Trust</div>
						<button type="button" class="font-semibold text-indigo-600 hover:text-indigo-500"
							>Update</button
						>
					</li>
					<li class="flex justify-between gap-x-6 py-6">
						<div class="font-medium text-gray-900">Royal Bank of Canada</div>
						<button type="button" class="font-semibold text-indigo-600 hover:text-indigo-500"
							>Update</button
						>
					</li>
				</ul>
			</div>
		</div>
	</main>
</div>
