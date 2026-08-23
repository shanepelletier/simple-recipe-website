from django.http import JsonResponse


def not_found(request, exception=None):
    return JsonResponse({"error": "Not found.", "fields": {}}, status=404)


def server_error(request):
    return JsonResponse({"error": "Something went wrong.", "fields": {}}, status=500)
