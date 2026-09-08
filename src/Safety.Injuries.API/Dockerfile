# См. статью по ссылке https://aka.ms/customizecontainer, чтобы узнать, как настроить контейнер отладки и как Visual Studio использует этот Dockerfile для создания образов для ускорения отладки.

# Этот этап используется при запуске из VS в быстром режиме (по умолчанию для конфигурации отладки)
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081


# Этот этап используется для компиляции проекта службы
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
# Аргументы для передачи версии и хэша коммита на этап сборки
ARG APP_VERSION
ARG GIT_COMMIT
ARG BUILD_DATE
ARG ASPNETCORE_ENVIRONMENT

ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["src/Safety.Injuries.API/Safety.Injuries.API.csproj", "src/Safety.Injuries.API/"]
COPY ["src/Safety.Injuries.Application/Safety.Injuries.Application.csproj", "src/Safety.Injuries.Application/"]
COPY ["src/Safety.Injuries.Domain/Safety.Injuries.Domain.csproj", "src/Safety.Injuries.Domain/"]
COPY ["src/Safety.Injuries.Infrastructure/Safety.Injuries.Infrastructure.csproj", "src/Safety.Injuries.Infrastructure/"]
RUN dotnet restore "./src/Safety.Injuries.API/Safety.Injuries.API.csproj"
COPY . .
WORKDIR "/src/src/Safety.Injuries.API"
RUN dotnet build "./Safety.Injuries.API.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Safety.Injuries.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# Этот этап используется для запуска приложения
FROM base AS final

# Пробрасываем аргументы сборки в переменные окружения контейнера
ENV APP_VERSION=$APP_VERSION
ENV GIT_COMMIT=$GIT_COMMIT
ENV BUILD_DATE=$BUILD_DATE
ENV ASPNETCORE_ENVIRONMENT=$ASPNETCORE_ENVIRONMENT

WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Safety.Injuries.API.dll"]