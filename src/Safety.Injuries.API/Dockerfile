# Этап 1: Базовый образ для запуска (ASP.NET Core Runtime)
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base

ARG GIT_COMMIT=unknown
ARG APP_VERSION=1.0.0
ENV GIT_COMMIT=${GIT_COMMIT}
ENV APP_VERSION=${APP_VERSION}

WORKDIR /app
EXPOSE 8080
EXPOSE 8081
ENV ASPNETCORE_HTTP_PORTS=8080

# Этап 2: Образ для сборки (SDK)
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Копируем файлы проектов для восстановления зависимостей (кэширование слоя)
COPY ["src/Safety.Injuries.API/Safety.Injuries.API.csproj", "src/Safety.Injuries.API/"]
COPY ["src/Safety.Injuries.Application/Safety.Injuries.Application.csproj", "src/Safety.Injuries.Application/"]
COPY ["src/Safety.Injuries.Domain/Safety.Injuries.Domain.csproj", "src/Safety.Injuries.Domain/"]
COPY ["src/Safety.Injuries.Infrastructure/Safety.Injuries.Infrastructure.csproj", "src/Safety.Injuries.Infrastructure/"]

# Восстанавливаем пакеты
RUN dotnet restore "./src/Safety.Injuries.API/Safety.Injuries.API.csproj"

# Копируем весь исходный код
COPY . .

# Переходим в папку API проекта и собираем
WORKDIR "/src/src/Safety.Injuries.API"
RUN dotnet build "./Safety.Injuries.API.csproj" -c $BUILD_CONFIGURATION -o /app/build

# Этап 3: Публикация
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Safety.Injuries.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# Этап 4: Финальный образ
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Safety.Injuries.API.dll"]